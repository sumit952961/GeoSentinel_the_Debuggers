"""
============================================================
DRAS — India-Specific Model Training Pipeline (v2.0)
============================================================

Implements:
  1. Class-weighted Cross-Entropy and Focal loss to counter 99.5% background imbalance.
  2. Geographic event-level data splitting (Chamoli + Fani train, held-out validation).
  3. Pretrained xBD transfer learning with cosine learning rate scheduling.
  4. Best checkpoint tracking by validation Building mIoU.
  5. Loss & mIoU curve visualization generation (training_curves.png).

Usage:
  python scripts/train_india_v2.py
  python scripts/train_india_v2.py --config configs/india_damage_v2.yaml
  python scripts/train_india_v2.py --epochs 5 --lr 1e-4
"""

import os
import sys
import time
import json
import argparse
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(os.path.join(ROOT_DIR, "ai-service"))

from app.cv.models import BuildingDamageUNet
from app.cv.loss import CombinedLoss, FocalLoss
from app.cv.metrics import compute_metrics
from app.cv.india_dataset import IndiaDisasterDataset, create_india_split


def load_config(config_path=None):
    default_cfg = {
        "model": {
            "architecture": "unet",
            "encoder": "resnet34",
            "mode": "pre_post",
            "num_classes": 5,
            "pretrained_weights": os.path.join(ROOT_DIR, "ai-service", "models", "unet_resnet34_pre_post.pth")
        },
        "training": {
            "epochs": 5,
            "batch_size": 4,
            "learning_rate": 1e-4,
            "weight_decay": 1e-4,
            "loss_type": "ce_dice",
            "use_class_weights": True,
            "class_weights": [0.15, 1.0, 3.5, 3.0, 5.0],
            "image_size": [512, 512]
        },
        "data": {
            "manifest": os.path.join(ROOT_DIR, "data", "india", "india_manifest.csv"),
            "root_dir": os.path.join(ROOT_DIR, "data", "india"),
            "train_events": ["chamoli_2021", "fani_2019"],
            "test_events": ["dharali_2025"],
            "val_fraction": 0.20,
            "min_confidence": 0.0
        },
        "output": {
            "checkpoint_dir": os.path.join(ROOT_DIR, "models", "india_v2"),
            "training_log": os.path.join(ROOT_DIR, "outputs", "india_evaluation", "india_v2_training_log.json"),
            "curves_plot": os.path.join(ROOT_DIR, "outputs", "india_evaluation", "training_curves.png")
        }
    }

    if config_path and os.path.exists(config_path):
        try:
            import yaml
            with open(config_path, "r", encoding="utf-8") as f:
                loaded = yaml.safe_load(f)
                if "training" in loaded:
                    default_cfg["training"].update(loaded["training"])
                if "model" in loaded:
                    default_cfg["model"].update(loaded["model"])
                if "dataset" in loaded:
                    default_cfg["data"]["train_events"] = loaded["dataset"].get("train_events", default_cfg["data"]["train_events"])
                    default_cfg["data"]["test_events"] = loaded["dataset"].get("test_events", default_cfg["data"]["test_events"])
                if "output" in loaded:
                    for k, v in loaded["output"].items():
                        default_cfg["output"][k] = os.path.join(ROOT_DIR, v) if not os.path.isabs(v) else v
        except Exception as e:
            print(f"[WARN] Failed to parse config YAML: {e}. Using defaults.")

    return default_cfg


def train_epoch(model, loader, loss_fn, optimizer, device):
    model.train()
    total_loss = 0.0
    count = 0
    for batch in loader:
        images = batch["image"].to(device)
        targets = batch["mask"].to(device)

        optimizer.zero_grad()
        logits = model(images)
        loss = loss_fn(logits, targets)
        loss.backward()
        optimizer.step()

        total_loss += loss.item() * len(images)
        count += len(images)

    return total_loss / max(1, count)


def validate(model, loader, loss_fn, device):
    model.eval()
    total_loss = 0.0
    count = 0
    all_preds = []
    all_targets = []

    with torch.no_grad():
        for batch in loader:
            images = batch["image"].to(device)
            targets = batch["mask"].to(device)

            logits = model(images)
            loss = loss_fn(logits, targets)

            probs = torch.softmax(logits, dim=1)
            preds = torch.argmax(probs, dim=1).cpu().numpy()

            all_preds.extend(list(preds))
            all_targets.extend(list(targets.cpu().numpy()))

            total_loss += loss.item() * len(images)
            count += len(images)

    mean_loss = total_loss / max(1, count)
    y_true = np.array(all_targets).flatten()
    y_pred = np.array(all_preds).flatten()
    metrics = compute_metrics(y_true, y_pred)
    return mean_loss, metrics



def plot_curves(history, save_path):
    epochs = range(1, len(history["train_loss"]) + 1)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4.5))

    # Loss curve
    ax1.plot(epochs, history["train_loss"], "b-o", label="Train Loss")
    ax1.plot(epochs, history["val_loss"], "r--s", label="Val Loss")
    ax1.set_title("Training & Validation Loss (Class-Weighted)")
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Loss")
    ax1.grid(True, linestyle=":", alpha=0.6)
    ax1.legend()

    # mIoU curve
    ax2.plot(epochs, [m * 100 for m in history["val_miou"]], "g-o", label="Mean IoU (%)")
    ax2.plot(epochs, [m * 100 for m in history["val_building_miou"]], "m--^", label="Building mIoU (%)")
    ax2.set_title("Validation IoU Metrics")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Percentage (%)")
    ax2.grid(True, linestyle=":", alpha=0.6)
    ax2.legend()

    plt.tight_layout()
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    plt.savefig(save_path, dpi=150)
    plt.close()
    print(f"  [SAVED] Training curves plot: {save_path}")


def main():
    parser = argparse.ArgumentParser(description="DRAS India Damage Model Training v2")
    parser.add_argument("--config", type=str, default="configs/india_damage_v2.yaml")
    parser.add_argument("--epochs", type=int, default=None)
    parser.add_argument("--lr", type=float, default=None)
    parser.add_argument("--batch-size", type=int, default=None)
    args = parser.parse_args()

    cfg = load_config(args.config)
    if args.epochs:
        cfg["training"]["epochs"] = args.epochs
    if args.lr:
        cfg["training"]["learning_rate"] = args.lr
    if args.batch_size:
        cfg["training"]["batch_size"] = args.batch_size

    device = "cuda" if torch.cuda.is_available() else "cpu"
    os.makedirs(cfg["output"]["checkpoint_dir"], exist_ok=True)

    print("=" * 75)
    print("DRAS v2.0 — INDIA-SPECIFIC MODEL FINE-TUNING (EXPERIMENT 1)")
    print("=" * 75)
    print(f"Device:          {device.upper()}")
    print(f"Pretrained Base: {cfg['model']['pretrained_weights']}")
    print(f"Training Events: {cfg['data']['train_events']}")
    print(f"Test Events:     {cfg['data']['test_events']}")
    print(f"Class Weights:   {cfg['training']['class_weights']}")
    print(f"Epochs:          {cfg['training']['epochs']}")
    print(f"Batch Size:      {cfg['training']['batch_size']}")
    print(f"Learning Rate:   {cfg['training']['learning_rate']}")

    # Create dataset split
    manifest_path = cfg["data"]["manifest"]
    train_pairs, val_pairs, test_pairs = create_india_split(
        manifest_path,
        train_events=cfg["data"]["train_events"],
        test_events=cfg["data"]["test_events"],
        val_fraction=cfg["data"]["val_fraction"],
        seed=42
    )

    data_root = cfg["data"]["root_dir"]
    target_size = tuple(cfg["training"]["image_size"])
    mode = cfg["model"]["mode"]

    ds_train = IndiaDisasterDataset(train_pairs, data_root, mode=mode, target_size=target_size, is_training=True)
    ds_val = IndiaDisasterDataset(val_pairs, data_root, mode=mode, target_size=target_size, is_training=False)

    loader_train = DataLoader(ds_train, batch_size=cfg["training"]["batch_size"], shuffle=True)
    loader_val = DataLoader(ds_val, batch_size=cfg["training"]["batch_size"], shuffle=False)

    print(f"\nDatasets: Train={len(ds_train)} tiles, Val={len(ds_val)} tiles, Held-out Test={len(test_pairs)} tiles")

    # Build model
    model = BuildingDamageUNet(mode=mode, num_classes=cfg["model"]["num_classes"], encoder_name=cfg["model"]["encoder"])
    pretrained_path = cfg["model"]["pretrained_weights"]
    if os.path.exists(pretrained_path):
        state_dict = torch.load(pretrained_path, map_location=device, weights_only=True)
        model.load_state_dict(state_dict, strict=False)
        print("  [OK] Pretrained xBD baseline weights loaded.")
    else:
        print("  [WARN] Pretrained weights not found, using ImageNet initialisation.")

    model.to(device)

    # Class-weighted combined loss
    weights = torch.tensor(cfg["training"]["class_weights"], dtype=torch.float32, device=device)
    loss_fn = CombinedLoss(loss_type=cfg["training"]["loss_type"], class_weights=weights)

    optimizer = torch.optim.AdamW(model.parameters(), lr=cfg["training"]["learning_rate"], weight_decay=cfg["training"]["weight_decay"])
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=cfg["training"]["epochs"], eta_min=1e-6)

    history = {
        "experiment_id": "india_v2_balanced_finetune",
        "date": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "config": cfg,
        "train_loss": [],
        "val_loss": [],
        "val_miou": [],
        "val_building_miou": [],
        "best_epoch": 0,
        "best_building_miou": 0.0
    }

    best_bmiou = 0.0
    num_epochs = cfg["training"]["epochs"]

    print("\nStarting fine-tuning...")
    for epoch in range(1, num_epochs + 1):
        t0 = time.time()
        train_loss = train_epoch(model, loader_train, loss_fn, optimizer, device)
        val_loss, val_metrics = validate(model, loader_val, loss_fn, device)
        scheduler.step()
        elapsed = time.time() - t0

        v_miou = val_metrics["mean_iou"]
        v_bmiou = val_metrics["building_mean_iou"]

        history["train_loss"].append(float(train_loss))
        history["val_loss"].append(float(val_loss))
        history["val_miou"].append(float(v_miou))
        history["val_building_miou"].append(float(v_bmiou))

        print(f"  Epoch {epoch:02d}/{num_epochs:02d} [{elapsed:.1f}s] | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | mIoU: {v_miou*100:.2f}% | Bldg mIoU: {v_bmiou*100:.2f}%")

        if v_bmiou >= best_bmiou:
            best_bmiou = v_bmiou
            history["best_epoch"] = epoch
            history["best_building_miou"] = float(best_bmiou)
            best_path = os.path.join(cfg["output"]["checkpoint_dir"], "best_model.pth")
            torch.save(model.state_dict(), best_path)
            print(f"    --> [SAVED] Checkpoint (Bldg mIoU: {best_bmiou*100:.2f}%) -> {best_path}")

    # Save final model & log
    final_path = os.path.join(cfg["output"]["checkpoint_dir"], "final_model.pth")
    torch.save(model.state_dict(), final_path)

    log_path = cfg["output"]["training_log"]
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    with open(log_path, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)

    plot_curves(history, cfg["output"]["curves_plot"])

    print("\n" + "=" * 75)
    print("FINE-TUNING COMPLETE")
    print(f"Best Epoch:           {history['best_epoch']}")
    print(f"Best Building mIoU:   {history['best_building_miou']*100:.2f}%")
    print(f"Model Checkpoint:     {best_path}")
    print(f"Training Log:         {log_path}")
    print("=" * 75)
    return history


if __name__ == "__main__":
    main()
