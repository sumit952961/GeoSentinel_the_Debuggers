"""
============================================================
Disaster Management System — Controlled CV Diagnostic Experiments
============================================================

Runs 3 controlled experiments on CPU to identify root causes and solutions:
  Experiment 1: Epoch Scaling (5 vs 10 vs 15 epochs)
  Experiment 2: Loss Function (Unweighted vs Class-Weighted vs Focal+Dice)
  Experiment 3: Two-Task Formulation (Binary Building Localization vs 5-Class Single-Step)
"""

import os
import sys
import time
import json
import torch
import torch.nn as nn
import numpy as np
from torch.utils.data import DataLoader, Subset

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.append(os.path.join(ROOT_DIR, "ai-service"))
OUTPUTS_DIR = os.path.join(ROOT_DIR, "ai-service", "outputs")
EXP_OUTPUT_PATH = os.path.join(OUTPUTS_DIR, "controlled_experiments_results.json")

from app.cv.dataset import create_disaster_aware_split, XBDDataset
from app.cv.models import BuildingDamageUNet
from app.cv.loss import CombinedLoss
from app.cv.metrics import compute_metrics, CLASS_NAMES

# ----------------------------------------------------------------------
# Custom Focal Loss for Severe Class Imbalance
# ----------------------------------------------------------------------
class FocalLoss(nn.Module):
    def __init__(self, alpha=None, gamma=2.0):
        super().__init__()
        self.gamma = gamma
        self.alpha = alpha  # Tensor of class weights
        self.ce = nn.CrossEntropyLoss(weight=alpha, reduction="none")

    def forward(self, inputs, targets):
        ce_loss = self.ce(inputs, targets)
        pt = torch.exp(-ce_loss)
        focal_loss = ((1.0 - pt) ** self.gamma) * ce_loss
        return focal_loss.mean()


class WeightedCombinedLoss(nn.Module):
    def __init__(self, class_weights=None, ce_weight=0.5, dice_weight=0.5, use_focal=False):
        super().__init__()
        self.ce_weight = ce_weight
        self.dice_weight = dice_weight
        self.num_classes = len(class_weights) if class_weights is not None else 5
        
        if use_focal:
            self.ce_fn = FocalLoss(alpha=class_weights, gamma=2.0)
        else:
            self.ce_fn = nn.CrossEntropyLoss(weight=class_weights)
            
    def forward(self, logits, targets):
        loss_ce = self.ce_fn(logits, targets)
        
        # Softmax for multi-class dice
        probs = torch.softmax(logits, dim=1)
        targets_one_hot = torch.zeros_like(probs).scatter_(1, targets.unsqueeze(1), 1.0)
        
        dims = (0, 2, 3)
        intersection = torch.sum(probs * targets_one_hot, dims)
        cardinality = torch.sum(probs + targets_one_hot, dims)
        
        dice_score = (2.0 * intersection + 1e-6) / (cardinality + 1e-6)
        # Give higher weight to damage classes in Dice
        dice_loss = 1.0 - torch.mean(dice_score[1:])  # Ignore background in dice penalty
        
        return self.ce_weight * loss_ce + self.dice_weight * dice_loss


def train_and_eval(model, train_loader, val_loader, test_loader, criterion, epochs=5, lr=2e-4):
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    
    train_history = []
    val_history = []
    
    t0 = time.time()
    for ep in range(epochs):
        model.train()
        t_loss = 0.0
        for batch in train_loader:
            imgs = batch["image"]
            masks = batch["mask"]
            optimizer.zero_grad()
            logits = model(imgs)
            loss = criterion(logits, masks)
            loss.backward()
            optimizer.step()
            t_loss += loss.item() * len(masks)
        t_loss /= len(train_loader.dataset)
        train_history.append(t_loss)
        
        # Validation
        model.eval()
        v_loss = 0.0
        with torch.no_grad():
            for batch in val_loader:
                imgs = batch["image"]
                masks = batch["mask"]
                logits = model(imgs)
                loss = criterion(logits, masks)
                v_loss += loss.item() * len(masks)
        v_loss /= len(val_loader.dataset)
        val_history.append(v_loss)
        
    duration = time.time() - t0
    
    # Evaluate on test set
    model.eval()
    all_preds = []
    all_targets = []
    with torch.no_grad():
        for batch in test_loader:
            imgs = batch["image"]
            masks = batch["mask"]
            logits = model(imgs)
            preds = torch.argmax(logits, dim=1)
            all_preds.append(preds.numpy())
            all_targets.append(masks.numpy())
            
    preds_np = np.concatenate(all_preds, axis=0)
    targets_np = np.concatenate(all_targets, axis=0)
    
    nc = criterion.num_classes if hasattr(criterion, 'num_classes') else 5
    metrics = compute_metrics(targets_np.flatten(), preds_np.flatten(), num_classes=nc)
    metrics["train_history"] = train_history
    metrics["val_history"] = val_history
    metrics["duration_seconds"] = round(duration, 2)
    return metrics


def run_experiments():
    print("=" * 80)
    print("RUNNING CONTROLLED CV DIAGNOSTIC EXPERIMENTS")
    print("=" * 80)
    
    data_dir = os.path.join(ROOT_DIR, "data", "xbd_subset_v2")
    manifest_csv = os.path.join(data_dir, "manifest.csv")
    train_pairs, val_pairs, test_pairs = create_disaster_aware_split(manifest_csv)
    
    train_ds = XBDDataset(train_pairs, data_dir, mode="pre_post", target_size=(512, 512), is_training=True)
    val_ds = XBDDataset(val_pairs, data_dir, mode="pre_post", target_size=(512, 512), is_training=False)
    test_ds = XBDDataset(test_pairs, data_dir, mode="pre_post", target_size=(512, 512), is_training=False)
    
    # Use subset of training pairs (24 pairs) for fast CPU experimentation
    fast_train_indices = list(range(0, len(train_ds), 2))  # 24 pairs
    train_subset = Subset(train_ds, fast_train_indices)
    
    train_loader = DataLoader(train_subset, batch_size=4, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=4, shuffle=False)
    test_loader = DataLoader(test_ds, batch_size=4, shuffle=False)
    
    results = {}
    
    # -------------------------------------------------------------
    # EXP 1: Epoch Scaling (5 vs 10 vs 15 epochs) with Baseline Loss
    # -------------------------------------------------------------
    print("\n[Experiment 1] Epoch Scaling (5 vs 10 vs 15 epochs)...")
    baseline_criterion = CombinedLoss(ce_weight=0.5, dice_weight=0.5, num_classes=5)
    
    for ep in [5, 10, 15]:
        print(f"  --> Training {ep} epochs...")
        m = BuildingDamageUNet(mode="pre_post", num_classes=5)
        res = train_and_eval(m, train_loader, val_loader, test_loader, baseline_criterion, epochs=ep)
        results[f"epoch_scaling_{ep}_epochs"] = {
            "epochs": ep,
            "bldg_macro_f1": res["building_macro_f1"],
            "bldg_mIoU": res["building_mean_iou"],
            "train_loss_final": res["train_history"][-1],
            "val_loss_final": res["val_history"][-1],
            "duration_s": res["duration_seconds"],
            "per_class": res["per_class"]
        }
        print(f"      Result: Bldg Macro F1={res['building_macro_f1']*100:.2f}% | Bldg mIoU={res['building_mean_iou']*100:.2f}% | Time={res['duration_seconds']}s")
        
    # -------------------------------------------------------------
    # EXP 2: Loss Formulation Comparison (Unweighted vs Class-Weighted vs Focal)
    # -------------------------------------------------------------
    print("\n[Experiment 2] Loss Function Formulations (10 epochs)...")
    
    # Class weights based on inverse pixel frequencies (normalized)
    # Background: 0.2, No-Damage: 2.0, Minor: 10.0, Major: 10.0, Destroyed: 10.0
    weights_tensor = torch.tensor([0.2, 2.0, 10.0, 10.0, 10.0], dtype=torch.float32)
    
    loss_configs = [
        ("loss_class_weighted_ce_dice", WeightedCombinedLoss(class_weights=weights_tensor, use_focal=False)),
        ("loss_focal_weighted_dice", WeightedCombinedLoss(class_weights=weights_tensor, use_focal=True))
    ]
    
    for name, crit in loss_configs:
        print(f"  --> Training with {name}...")
        m = BuildingDamageUNet(mode="pre_post", num_classes=5)
        res = train_and_eval(m, train_loader, val_loader, test_loader, crit, epochs=10)
        results[name] = {
            "bldg_macro_f1": res["building_macro_f1"],
            "bldg_mIoU": res["building_mean_iou"],
            "train_loss_final": res["train_history"][-1],
            "val_loss_final": res["val_history"][-1],
            "duration_s": res["duration_seconds"],
            "per_class": res["per_class"]
        }
        print(f"      Result: Bldg Macro F1={res['building_macro_f1']*100:.2f}% | Bldg mIoU={res['building_mean_iou']*100:.2f}% | Time={res['duration_seconds']}s")

    # -------------------------------------------------------------
    # EXP 3: Binary Building Localization Formulation (Task 1)
    # -------------------------------------------------------------
    print("\n[Experiment 3] Two-Task Formulation: Binary Building Localization...")
    # Binary: 0=Background, 1=Building (any damage class)
    # Custom dataset wrapper for binary targets
    class BinaryDatasetWrapper(torch.utils.data.Dataset):
        def __init__(self, base_ds):
            self.base = base_ds
        def __len__(self):
            return len(self.base)
        def __getitem__(self, idx):
            item = self.base[idx]
            binary_mask = (item["mask"] > 0).long()
            return {"image": item["image"], "mask": binary_mask}
            
    bin_train_loader = DataLoader(BinaryDatasetWrapper(train_subset), batch_size=4, shuffle=True)
    bin_val_loader = DataLoader(BinaryDatasetWrapper(val_ds), batch_size=4, shuffle=False)
    bin_test_loader = DataLoader(BinaryDatasetWrapper(test_ds), batch_size=4, shuffle=False)
    
    bin_model = BuildingDamageUNet(mode="pre_post", num_classes=2)
    bin_weights = torch.tensor([0.2, 5.0], dtype=torch.float32)
    bin_criterion = WeightedCombinedLoss(class_weights=bin_weights, use_focal=False)
    
    res_bin = train_and_eval(bin_model, bin_train_loader, bin_val_loader, bin_test_loader, bin_criterion, epochs=10)
    results["two_stage_binary_building_localization"] = {
        "building_iou": res_bin["per_class"][1]["iou"],
        "building_f1": res_bin["per_class"][1]["f1"],
        "building_precision": res_bin["per_class"][1]["precision"],
        "building_recall": res_bin["per_class"][1]["recall"],
        "overall_accuracy": res_bin["overall_accuracy"],
        "duration_s": res_bin["duration_seconds"]
    }
    print(f"      Result: Binary Building Localization -> IoU={res_bin['per_class'][1]['iou']*100:.2f}% | F1={res_bin['per_class'][1]['f1']*100:.2f}% | Precision={res_bin['per_class'][1]['precision']*100:.2f}% | Recall={res_bin['per_class'][1]['recall']*100:.2f}%")

    with open(EXP_OUTPUT_PATH, "w") as f:
        json.dump(results, f, indent=2)
        
    print("\n" + "=" * 80)
    print(f"All Controlled Experiments Completed! Saved to {EXP_OUTPUT_PATH}")
    print("=" * 80)


if __name__ == "__main__":
    run_experiments()
