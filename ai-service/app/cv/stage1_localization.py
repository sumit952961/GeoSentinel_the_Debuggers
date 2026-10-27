"""
============================================================
Disaster Management System — Stage 1: Binary Building Localization
============================================================

Implements:
  1. Binary Building Segmentation Dataset (0=Background, 1=Building)
  2. U-Net + ResNet34 Architecture for 3-channel (Pre/Post) and 6-channel (Pre+Post)
  3. Combined BCEWithLogits + Soft Dice Loss with positive class weighting
  4. Complete 3-Way Benchmark (Pre-Only vs Post-Only vs Pre+Post)
  5. 4-Panel Visual Diagnostics Generation
  6. RoI Building Region Extraction Infrastructure for Stage 2
"""

import os
import sys
import time
import json
import cv2
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import segmentation_models_pytorch as smp
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.append(os.path.join(ROOT_DIR, "ai-service"))

from app.cv.dataset import create_disaster_aware_split, XBDDataset

DATA_DIR = os.path.join(ROOT_DIR, "data", "xbd_subset_v2")
MANIFEST_CSV = os.path.join(DATA_DIR, "manifest.csv")
MODELS_DIR = os.path.join(ROOT_DIR, "ai-service", "models")
OUTPUTS_DIR = os.path.join(ROOT_DIR, "ai-service", "outputs")
STAGE1_VIS_DIR = os.path.join(OUTPUTS_DIR, "stage1_visuals")
STAGE1_CROPS_DIR = os.path.join(OUTPUTS_DIR, "stage1_extracted_crops")

os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(OUTPUTS_DIR, exist_ok=True)
os.makedirs(STAGE1_VIS_DIR, exist_ok=True)
os.makedirs(STAGE1_CROPS_DIR, exist_ok=True)


# ----------------------------------------------------------------------
# 1. Binary Dataset Wrapper
# ----------------------------------------------------------------------
class BinaryBuildingDataset(Dataset):
    """
    Wraps XBDDataset and converts 5-class target masks into binary building masks:
      0 = Background
      1 = Building (any damage level: no-damage, minor, major, destroyed)
    """
    def __init__(self, base_dataset):
        self.base_dataset = base_dataset

    def __len__(self):
        return len(self.base_dataset)

    def __getitem__(self, idx):
        item = self.base_dataset[idx]
        raw_mask = item["mask"].numpy() if isinstance(item["mask"], torch.Tensor) else item["mask"]
        
        # Binary target: 1 if pixel is in any building class (1..4), else 0
        bin_mask = (raw_mask > 0).astype(np.float32)
        
        return {
            "image": item["image"],
            "mask": torch.tensor(bin_mask, dtype=torch.float32).unsqueeze(0), # (1, H, W)
            "raw_multiclass_mask": torch.tensor(raw_mask, dtype=torch.long),
            "pair_id": item["pair_id"],
            "disaster": item["disaster"],
            "pre_rgb_raw": item["pre_rgb_raw"],
            "post_rgb_raw": item["post_rgb_raw"]
        }


# ----------------------------------------------------------------------
# 2. Binary Segmentation Loss: Weighted BCE + Soft Dice
# ----------------------------------------------------------------------
class BinaryBCEDiceLoss(nn.Module):
    def __init__(self, pos_weight=5.0, bce_weight=0.5, dice_weight=0.5):
        super().__init__()
        self.bce_weight = bce_weight
        self.dice_weight = dice_weight
        self.bce = nn.BCEWithLogitsLoss(pos_weight=torch.tensor([pos_weight]))

    def forward(self, logits, targets):
        # BCE Loss
        bce_loss = self.bce(logits, targets)
        
        # Soft Dice Loss
        probs = torch.sigmoid(logits)
        intersection = torch.sum(probs * targets)
        cardinality = torch.sum(probs + targets)
        dice_score = (2.0 * intersection + 1e-6) / (cardinality + 1e-6)
        dice_loss = 1.0 - dice_score
        
        return self.bce_weight * bce_loss + self.dice_weight * dice_loss


# ----------------------------------------------------------------------
# 3. Binary Model Architecture (U-Net with ResNet34 Backbone)
# ----------------------------------------------------------------------
class BuildingLocalizationUNet(nn.Module):
    def __init__(self, in_channels=3):
        super().__init__()
        self.in_channels = in_channels
        self.model = smp.Unet(
            encoder_name="resnet34",
            encoder_weights="imagenet",
            in_channels=in_channels,
            classes=1
        )

    def forward(self, x):
        return self.model(x)

    def count_parameters(self):
        total = sum(p.numel() for p in self.parameters())
        trainable = sum(p.numel() for p in self.parameters() if p.requires_grad)
        return total, trainable


# ----------------------------------------------------------------------
# 4. Binary Evaluation Metrics Calculator
# ----------------------------------------------------------------------
def calculate_binary_metrics(y_true, y_pred_prob, threshold=0.5):
    """
    y_true: 1D binary array (0 or 1)
    y_pred_prob: 1D probability array [0.0 .. 1.0]
    """
    preds = (y_pred_prob >= threshold).astype(np.uint8)
    targets = (y_true > 0).astype(np.uint8)
    
    tp = np.sum((preds == 1) & (targets == 1))
    fp = np.sum((preds == 1) & (targets == 0))
    fn = np.sum((preds == 0) & (targets == 1))
    tn = np.sum((preds == 0) & (targets == 0))
    
    total = tp + fp + fn + tn
    pixel_acc = (tp + tn) / total if total > 0 else 0.0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    iou = tp / (tp + fp + fn) if (tp + fp + fn) > 0 else 0.0
    
    return {
        "iou": float(iou),
        "f1": float(f1),
        "precision": float(precision),
        "recall": float(recall),
        "pixel_accuracy": float(pixel_acc),
        "tp": int(tp),
        "fp": int(fp),
        "fn": int(fn),
        "tn": int(tn),
        "building_pixel_support": int(tp + fn)
    }


# ----------------------------------------------------------------------
# 5. Training and Evaluation Routine for a Single Variant
# ----------------------------------------------------------------------
def train_and_evaluate_variant(variant_name, mode, in_channels, train_pairs, val_pairs, test_pairs, epochs=8, lr=3e-4):
    print("\n" + "=" * 70)
    print(f"TRAINING STAGE 1 VARIANT: {variant_name.upper()} ({mode}, {in_channels}-channel)")
    print("=" * 70)
    
    # Datasets & Loaders
    train_base = XBDDataset(train_pairs, DATA_DIR, mode=mode, target_size=(512, 512), is_training=True)
    val_base = XBDDataset(val_pairs, DATA_DIR, mode=mode, target_size=(512, 512), is_training=False)
    test_base = XBDDataset(test_pairs, DATA_DIR, mode=mode, target_size=(512, 512), is_training=False)
    
    train_ds = BinaryBuildingDataset(train_base)
    val_ds = BinaryBuildingDataset(val_base)
    test_ds = BinaryBuildingDataset(test_base)
    
    train_loader = DataLoader(train_ds, batch_size=4, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=4, shuffle=False)
    test_loader = DataLoader(test_ds, batch_size=4, shuffle=False)
    
    model = BuildingLocalizationUNet(in_channels=in_channels)
    tot_params, train_params = model.count_parameters()
    print(f"Model Parameters: {tot_params:,} (Trainable: {train_params:,})")
    
    criterion = BinaryBCEDiceLoss(pos_weight=5.0, bce_weight=0.5, dice_weight=0.5)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)
    
    best_val_f1 = -1.0
    best_weights = None
    
    train_history = []
    val_history = []
    
    t_start = time.time()
    for ep in range(1, epochs + 1):
        ep_start = time.time()
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
        scheduler.step()
        
        # Validation
        model.eval()
        v_loss = 0.0
        all_v_preds = []
        all_v_targets = []
        with torch.no_grad():
            for batch in val_loader:
                imgs = batch["image"]
                masks = batch["mask"]
                logits = model(imgs)
                loss = criterion(logits, masks)
                v_loss += loss.item() * len(masks)
                probs = torch.sigmoid(logits).squeeze(1).cpu().numpy()
                all_v_preds.append(probs)
                all_v_targets.append(masks.squeeze(1).cpu().numpy())
        v_loss /= len(val_loader.dataset)
        val_history.append(v_loss)
        
        v_preds_np = np.concatenate(all_v_preds, axis=0).flatten()
        v_targets_np = np.concatenate(all_v_targets, axis=0).flatten()
        val_metrics = calculate_binary_metrics(v_targets_np, v_preds_np, threshold=0.5)
        
        ep_duration = time.time() - ep_start
        print(f"  Epoch {ep:02d}/{epochs:02d} ({ep_duration:.1f}s) | Train Loss: {t_loss:.4f} | Val Loss: {v_loss:.4f} | Val IoU: {val_metrics['iou']*100:.2f}% | Val F1: {val_metrics['f1']*100:.2f}% | Recall: {val_metrics['recall']*100:.2f}%")
        
        if val_metrics["f1"] > best_val_f1:
            best_val_f1 = val_metrics["f1"]
            best_weights = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            
    train_duration = time.time() - t_start
    
    # Load best checkpoint for test evaluation
    if best_weights is not None:
        model.load_state_dict(best_weights)
    model.eval()
    
    # Test Evaluation & CPU Latency Benchmark
    test_latencies = []
    all_t_preds = []
    all_t_targets = []
    test_batch_samples = []
    
    with torch.no_grad():
        for batch in test_loader:
            imgs = batch["image"]
            masks = batch["mask"]
            
            t0_infer = time.perf_counter()
            logits = model(imgs)
            t_infer_ms = ((time.perf_counter() - t0_infer) * 1000.0) / len(imgs)
            test_latencies.extend([t_infer_ms] * len(imgs))
            
            probs = torch.sigmoid(logits).squeeze(1).cpu().numpy()
            all_t_preds.append(probs)
            all_t_targets.append(masks.squeeze(1).cpu().numpy())
            
            for i in range(len(imgs)):
                test_batch_samples.append({
                    "pair_id": batch["pair_id"][i],
                    "disaster": batch["disaster"][i],
                    "pre_rgb": batch["pre_rgb_raw"][i].numpy(),
                    "post_rgb": batch["post_rgb_raw"][i].numpy(),
                    "gt_mask": masks[i].squeeze(0).cpu().numpy(),
                    "gt_multiclass": batch["raw_multiclass_mask"][i].cpu().numpy(),
                    "pred_prob": probs[i]
                })
                
    t_preds_np = np.concatenate(all_t_preds, axis=0).flatten()
    t_targets_np = np.concatenate(all_t_targets, axis=0).flatten()
    test_metrics = calculate_binary_metrics(t_targets_np, t_preds_np, threshold=0.5)
    
    test_metrics["mean_latency_ms"] = float(np.mean(test_latencies))
    test_metrics["std_latency_ms"] = float(np.std(test_latencies))
    test_metrics["throughput_fps"] = float(1000.0 / np.mean(test_latencies))
    test_metrics["train_duration_s"] = round(train_duration, 2)
    test_metrics["train_history"] = train_history
    test_metrics["val_history"] = val_history
    test_metrics["total_parameters"] = tot_params
    
    return model, test_metrics, test_batch_samples


# ----------------------------------------------------------------------
# 6. Visual Diagnostics Generator (4-Panel Figures)
# ----------------------------------------------------------------------
def generate_stage1_visual_diagnostics(samples, save_dir, variant_name):
    print(f"\n[Visualizer] Generating 4-panel diagnostic images for {len(samples)} test samples...")
    for s in samples:
        pair_id = s["pair_id"]
        pre_rgb = s["pre_rgb"]
        gt_mask = s["gt_mask"]
        pred_prob = s["pred_prob"]
        pred_bin = (pred_prob >= 0.5).astype(np.uint8)
        
        # Build overlay: Green where Pred=1, Red where GT=1 but Pred=0 (False Negative), Blue where Pred=1 but GT=0 (False Positive)
        h, w = gt_mask.shape
        overlay = pre_rgb.copy()
        
        # Highlight True Positives in Bright Cyan/Green
        tp_mask = (pred_bin == 1) & (gt_mask == 1)
        # Highlight False Positives in Magenta/Orange
        fp_mask = (pred_bin == 1) & (gt_mask == 0)
        # Highlight False Negatives in Yellow
        fn_mask = (pred_bin == 0) & (gt_mask == 1)
        
        overlay[tp_mask] = (overlay[tp_mask] * 0.4 + np.array([0, 230, 118]) * 0.6).astype(np.uint8)
        overlay[fp_mask] = (overlay[fp_mask] * 0.4 + np.array([255, 61, 0]) * 0.6).astype(np.uint8)
        overlay[fn_mask] = (overlay[fn_mask] * 0.4 + np.array([255, 234, 0]) * 0.6).astype(np.uint8)
        
        fig, axes = plt.subplots(1, 4, figsize=(20, 5))
        axes[0].imshow(pre_rgb)
        axes[0].set_title(f"Pre-Disaster RGB\n({pair_id})", fontsize=11, fontweight="bold")
        axes[0].axis("off")
        
        axes[1].imshow(gt_mask, cmap="gray", vmin=0, vmax=1)
        axes[1].set_title(f"Ground Truth Building Mask\n(Pixels: {int(np.sum(gt_mask)):,})", fontsize=11, fontweight="bold")
        axes[1].axis("off")
        
        axes[2].imshow(pred_bin, cmap="magma", vmin=0, vmax=1)
        axes[2].set_title(f"Predicted Building Mask\n(Prob >= 0.5)", fontsize=11, fontweight="bold")
        axes[2].axis("off")
        
        axes[3].imshow(overlay)
        axes[3].set_title("Diagnostic Overlay\n(Green=TP, Red=FP, Yellow=FN)", fontsize=11, fontweight="bold")
        axes[3].axis("off")
        
        plt.tight_layout()
        out_p = os.path.join(save_dir, f"{pair_id}_stage1_{variant_name}_4panel.png")
        plt.savefig(out_p, dpi=120, bbox_inches="tight")
        plt.close(fig)
        
    print(f"  [Saved] All 4-panel diagnostic images saved to: {save_dir}")


# ----------------------------------------------------------------------
# 7. Stage 2 RoI Region Extraction Infrastructure
# ----------------------------------------------------------------------
def extract_building_regions(pre_rgb, post_rgb, pred_bin_mask, gt_multiclass_mask=None, min_area=15, crop_padding=8):
    """
    Extracts individual building RoIs (Regions of Interest) from the predicted binary mask.
    
    For each detected building contour:
      - Extracts bounding polygon & bounding box
      - Crops matching pre-disaster and post-disaster image patches
      - Maps majority Ground-Truth damage class (if available) for training Stage 2 classifier
      - Computes polygon area in pixels and mean detection confidence
    """
    cnts, _ = cv2.findContours(pred_bin_mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    extracted_rois = []
    h_img, w_img = pred_bin_mask.shape
    
    for i, cnt in enumerate(cnts):
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue
            
        x, y, w, h = cv2.boundingRect(cnt)
        
        # Add padding to capture context (roof edges, surrounding debris)
        x0 = max(0, x - crop_padding)
        y0 = max(0, y - crop_padding)
        x1 = min(w_img, x + w + crop_padding)
        y1 = min(h_img, y + h + crop_padding)
        
        pre_crop = pre_rgb[y0:y1, x0:x1]
        post_crop = post_rgb[y0:y1, x0:x1]
        
        # Determine Ground-Truth damage class from multi-class mask inside this polygon
        gt_damage_label = 0
        damage_class_name = "unknown"
        if gt_multiclass_mask is not None:
            polygon_mask = np.zeros((h_img, w_img), dtype=np.uint8)
            cv2.drawContours(polygon_mask, [cnt], -1, 1, -1)
            poly_pixels = gt_multiclass_mask[polygon_mask == 1]
            
            # Non-background damage pixels inside polygon
            valid_bldg_pixels = poly_pixels[poly_pixels > 0]
            if len(valid_bldg_pixels) > 0:
                counts = np.bincount(valid_bldg_pixels)
                gt_damage_label = int(np.argmax(counts))
            else:
                gt_damage_label = 1  # Default to no-damage if inside localized footprint
                
            damage_names = {1: "no-damage", 2: "minor-damage", 3: "major-damage", 4: "destroyed"}
            damage_class_name = damage_names.get(gt_damage_label, "no-damage")
            
        extracted_rois.append({
            "roi_id": i + 1,
            "bbox": [int(x0), int(y0), int(x1), int(y1)],
            "polygon_points": cnt.squeeze(1).tolist(),
            "area_pixels": float(area),
            "pre_crop": pre_crop,
            "post_crop": post_crop,
            "gt_damage_label": gt_damage_label,
            "damage_class_name": damage_class_name
        })
        
    return extracted_rois


# ----------------------------------------------------------------------
# 8. Main Stage 1 Execution Pipeline
# ----------------------------------------------------------------------
def main():
    print("=" * 80)
    print("STAGE 1: BINARY BUILDING LOCALIZATION PIPELINE")
    print("=" * 80)
    
    # 1. Load disaster-stratified pair-level split
    train_pairs, val_pairs, test_pairs = create_disaster_aware_split(MANIFEST_CSV)
    print(f"[Dataset Split] Disaster-Stratified Pair-Level Split:")
    print(f"  - Training Set:   {len(train_pairs)} pairs (70.6%)")
    print(f"  - Validation Set: {len(val_pairs)} pairs (14.7%)")
    print(f"  - Test Set:       {len(test_pairs)} pairs (14.7%)")
    
    # 2. Run 3-Way Comparison: Pre-Only vs Post-Only vs Pre+Post
    configs = [
        ("pre_only", "pre_only", 3),
        ("post_only", "post_only", 3),
        ("pre_post", "pre_post", 6)
    ]
    
    comparison_results = {}
    best_variant = None
    best_f1 = -1.0
    best_model = None
    best_samples = None
    
    for var_name, mode, in_ch in configs:
        model, metrics, test_samples = train_and_evaluate_variant(
            variant_name=var_name,
            mode=mode,
            in_channels=in_ch,
            train_pairs=train_pairs,
            val_pairs=val_pairs,
            test_pairs=test_pairs,
            epochs=8,
            lr=3e-4
        )
        
        comparison_results[var_name] = metrics
        print(f"\n[{var_name.upper()} TEST RESULTS]")
        print(f"  Building IoU:       {metrics['iou']*100:.2f}%")
        print(f"  Building F1-Score:  {metrics['f1']*100:.2f}%")
        print(f"  Building Precision: {metrics['precision']*100:.2f}%")
        print(f"  Building Recall:    {metrics['recall']*100:.2f}%")
        print(f"  Pixel Accuracy:     {metrics['pixel_accuracy']*100:.2f}%")
        print(f"  Mean CPU Latency:   {metrics['mean_latency_ms']:.1f} ms / tile ({metrics['throughput_fps']:.2f} fps)")
        
        if metrics["f1"] > best_f1:
            best_f1 = metrics["f1"]
            best_variant = var_name
            best_model = model
            best_samples = test_samples
            
    # Save the Best Model Checkpoint
    best_weight_path = os.path.join(MODELS_DIR, "stage1_building_loc_best.pth")
    torch.save(best_model.state_dict(), best_weight_path)
    print(f"\n[Checkpoint] Saved Best Model ({best_variant.upper()}) to: {best_weight_path}")
    
    # 3. Generate 4-Panel Visual Diagnostics for Best Model
    generate_stage1_visual_diagnostics(best_samples, STAGE1_VIS_DIR, best_variant)
    
    # 4. Demonstrate & Validate Stage 2 Region Extraction Infrastructure
    print("\n" + "=" * 70)
    print("STAGE 2 INFRASTRUCTURE VALIDATION: BUILDING REGION CROPPING")
    print("=" * 70)
    sample_to_extract = best_samples[0]
    rois = extract_building_regions(
        sample_to_extract["pre_rgb"],
        sample_to_extract["post_rgb"],
        (sample_to_extract["pred_prob"] >= 0.5).astype(np.uint8),
        gt_multiclass_mask=sample_to_extract["gt_multiclass"]
    )
    print(f"  [Extraction Test] Extracted {len(rois)} building RoIs from pair: {sample_to_extract['pair_id']}")
    
    # Save sample cropped patches to disk for inspection
    roi_summary = []
    for roi in rois[:6]:
        r_id = roi["roi_id"]
        pre_crop_path = os.path.join(STAGE1_CROPS_DIR, f"roi_{r_id}_pre.png")
        post_crop_path = os.path.join(STAGE1_CROPS_DIR, f"roi_{r_id}_post.png")
        cv2.imwrite(pre_crop_path, cv2.cvtColor(roi["pre_crop"], cv2.COLOR_RGB2BGR))
        cv2.imwrite(post_crop_path, cv2.cvtColor(roi["post_crop"], cv2.COLOR_RGB2BGR))
        roi_summary.append({
            "roi_id": r_id,
            "bbox": roi["bbox"],
            "area_pixels": roi["area_pixels"],
            "gt_damage_label": roi["gt_damage_label"],
            "damage_class_name": roi["damage_class_name"],
            "pre_crop_file": pre_crop_path,
            "post_crop_file": post_crop_path
        })
        print(f"    RoI #{r_id:02d}: BBox={roi['bbox']} | Area={roi['area_pixels']:.0f}px | GT Label={roi['damage_class_name']}")
        
    # Save Benchmark Results JSON
    final_report = {
        "best_variant": best_variant,
        "variants": comparison_results,
        "sample_extracted_rois": roi_summary
    }
    
    results_json_path = os.path.join(OUTPUTS_DIR, "stage1_localization_results.json")
    with open(results_json_path, "w") as f:
        json.dump(final_report, f, indent=2)
        
    print("\n" + "=" * 80)
    print(f"Stage 1 Benchmark Completed! Saved results to {results_json_path}")
    print("=" * 80)


if __name__ == "__main__":
    main()
