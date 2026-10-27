"""
============================================================
India-Specific Model Training Pipeline
============================================================

Fine-tunes the xBD-pretrained U-Net ResNet34 on Indian disaster
imagery with verified damage labels.

Training Strategy:
  1. Load xBD-pretrained weights (baseline)
  2. Fine-tune on Chamoli 2021 (EIDC verified) + Wayanad 2024 (OSM tags)
  3. Validate on held-out tiles from training events
  4. Save best checkpoint based on validation mIoU

Usage:
  python scripts/train_india.py
  python scripts/train_india.py --config configs/india_damage.yaml
  python scripts/train_india.py --epochs 3 --lr 5e-5
"""

import os
import sys
import time
import json
import argparse
import numpy as np
import torch
from torch.utils.data import DataLoader

# Add project root to path
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(ROOT_DIR, "ai-service"))

from app.cv.models import BuildingDamageUNet
from app.cv.loss import CombinedLoss
from app.cv.metrics import compute_metrics
from app.cv.india_dataset import IndiaDisasterDataset, create_india_split


def load_config(config_path=None):
    """Load training configuration from YAML file."""
    if config_path and os.path.exists(config_path):
        try:
            import yaml
            with open(config_path, "r") as f:
                return yaml.safe_load(f)
        except ImportError:
            print("[WARNING] PyYAML not installed. Using default config.")
    
    # Default configuration
    return {
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
            "learning_rate": 5e-5,
            "weight_decay": 1e-4,
            "image_size": [512, 512]
        },
        "data": {
            "root_dir": os.path.join(ROOT_DIR, "data", "india"),
            "manifest": os.path.join(ROOT_DIR, "data", "india", "india_manifest.csv"),
            "train_events": ["chamoli_2021", "fani_2019"],
            "test_events": ["dharali_2025"],
            "val_fraction": 0.15,
            "min_confidence": 0.3
        },
        "output": {
            "checkpoint_dir": os.path.join(ROOT_DIR, "models", "india_v1"),
            "results_dir": os.path.join(ROOT_DIR, "outputs", "india_evaluation"),
            "training_log": os.path.join(ROOT_DIR, "outputs", "india_evaluation", "training_log.json")
        }
    }


def train_epoch(model, loader, loss_fn, optimizer, device="cpu"):
    """Run one training epoch."""
    model.train()
    losses = []
    
    for batch_idx, batch in enumerate(loader):
        images = batch["image"].to(device)
        masks = batch["mask"].to(device)
        
        optimizer.zero_grad()
        logits = model(images)
        loss = loss_fn(logits, masks)
        loss.backward()
        optimizer.step()
        
        losses.append(loss.item())
        
        if (batch_idx + 1) % 5 == 0:
            print(f"    Batch {batch_idx + 1}/{len(loader)} | Loss: {loss.item():.4f}")
    
    return float(np.mean(losses))


def validate(model, loader, loss_fn, device="cpu"):
    """Run validation and compute metrics."""
    model.eval()
    losses = []
    all_preds = []
    all_targets = []
    
    with torch.no_grad():
        for batch in loader:
            images = batch["image"].to(device)
            masks = batch["mask"].to(device)
            
            logits = model(images)
            loss = loss_fn(logits, masks)
            losses.append(loss.item())
            
            preds = torch.argmax(logits, dim=1).cpu().numpy().flatten()
            targets = masks.cpu().numpy().flatten()
            all_preds.extend(preds)
            all_targets.extend(targets)
    
    avg_loss = float(np.mean(losses))
    metrics = compute_metrics(np.array(all_targets), np.array(all_preds))
    
    return avg_loss, metrics


def main():
    parser = argparse.ArgumentParser(description="Train India-specific damage assessment model")
    parser.add_argument("--config", type=str, default=None, help="Path to YAML config")
    parser.add_argument("--epochs", type=int, default=None, help="Override number of epochs")
    parser.add_argument("--lr", type=float, default=None, help="Override learning rate")
    parser.add_argument("--batch-size", type=int, default=None, help="Override batch size")
    args = parser.parse_args()
    
    # Load configuration
    config_path = args.config or os.path.join(ROOT_DIR, "configs", "india_damage.yaml")
    cfg = load_config(config_path)
    
    # Apply CLI overrides
    if args.epochs:
        cfg["training"]["epochs"] = args.epochs
    if args.lr:
        cfg["training"]["learning_rate"] = args.lr
    if args.batch_size:
        cfg["training"]["batch_size"] = args.batch_size
    
    # Create output directories
    os.makedirs(cfg["output"]["checkpoint_dir"], exist_ok=True)
    os.makedirs(cfg["output"]["results_dir"], exist_ok=True)
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    
    print("=" * 80)
    print("INDIA-SPECIFIC DAMAGE ASSESSMENT MODEL — TRAINING PIPELINE")
    print("=" * 80)
    print(f"Device: {device.upper()}")
    print(f"Architecture: U-Net ResNet34 ({cfg['model']['mode']})")
    print(f"Training Events: {cfg['data']['train_events']}")
    print(f"Test Events: {cfg['data']['test_events']}")
    print(f"Epochs: {cfg['training']['epochs']}")
    print(f"Learning Rate: {cfg['training']['learning_rate']}")
    print(f"Batch Size: {cfg['training']['batch_size']}")
    
    # Check if manifest exists
    manifest_path = cfg["data"]["manifest"]
    if not os.path.exists(manifest_path):
        print(f"\n[ERROR] India manifest not found at: {manifest_path}")
        print("Run 'python scripts/india/prepare_india_dataset.py' first to generate the manifest.")
        sys.exit(1)
    
    # Create dataset split
    print("\n" + "=" * 60)
    print("DATASET SPLIT (Cross-Event Generalisation Design)")
    print("=" * 60)
    
    train_pairs, val_pairs, test_pairs = create_india_split(
        manifest_path,
        train_events=cfg["data"]["train_events"],
        test_events=cfg["data"]["test_events"],
        val_fraction=cfg["data"]["val_fraction"],
        seed=42
    )
    
    # Create PyTorch datasets
    data_root = cfg["data"]["root_dir"]
    target_size = tuple(cfg["training"]["image_size"])
    mode = cfg["model"]["mode"]
    
    ds_train = IndiaDisasterDataset(train_pairs, data_root, mode=mode,
                                     target_size=target_size, is_training=True,
                                     min_confidence=cfg["data"]["min_confidence"])
    ds_val = IndiaDisasterDataset(val_pairs, data_root, mode=mode,
                                   target_size=target_size, is_training=False)
    ds_test = IndiaDisasterDataset(test_pairs, data_root, mode=mode,
                                    target_size=target_size, is_training=False)
    
    loader_train = DataLoader(ds_train, batch_size=cfg["training"]["batch_size"], shuffle=True)
    loader_val = DataLoader(ds_val, batch_size=cfg["training"]["batch_size"], shuffle=False)
    
    print(f"\n  Train Dataset: {len(ds_train)} tiles")
    print(f"  Val Dataset:   {len(ds_val)} tiles")
    print(f"  Test Dataset:  {len(ds_test)} tiles")
    
    # Build model
    model = BuildingDamageUNet(
        mode=mode,
        num_classes=cfg["model"]["num_classes"],
        encoder_name=cfg["model"]["encoder"]
    )
    total_params, trainable_params = model.count_parameters()
    print(f"\n  Parameters: {total_params:,} total | {trainable_params:,} trainable")
    
    # Load pretrained weights (xBD baseline)
    pretrained_path = cfg["model"]["pretrained_weights"]
    if os.path.exists(pretrained_path):
        print(f"  Loading xBD pretrained weights from: {pretrained_path}")
        state_dict = torch.load(pretrained_path, map_location=device, weights_only=True)
        model.load_state_dict(state_dict, strict=False)
        print("  [OK] Pretrained weights loaded successfully (fine-tuning mode)")
    else:
        print(f"  [WARNING] Pretrained weights not found at {pretrained_path}")
        print("  Training from ImageNet-initialised weights instead.")
    
    model.to(device)
    
    # Loss and optimizer
    loss_fn = CombinedLoss(loss_type="ce_dice")
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=cfg["training"]["learning_rate"],
        weight_decay=cfg["training"]["weight_decay"]
    )
    
    # Training loop
    print("\n" + "=" * 60)
    print("TRAINING (India Fine-Tuning)")
    print("=" * 60)
    
    history = {
        "config": cfg,
        "train_loss": [],
        "val_loss": [],
        "val_miou": [],
        "val_building_miou": [],
        "best_epoch": 0,
        "best_val_miou": 0.0
    }
    
    best_miou = 0.0
    num_epochs = cfg["training"]["epochs"]
    
    for epoch in range(1, num_epochs + 1):
        t0 = time.time()
        
        # Train
        train_loss = train_epoch(model, loader_train, loss_fn, optimizer, device)
        
        # Validate
        val_loss, val_metrics = validate(model, loader_val, loss_fn, device)
        
        epoch_time = time.time() - t0
        val_miou = val_metrics["mean_iou"]
        val_bmiou = val_metrics["building_mean_iou"]
        
        history["train_loss"].append(train_loss)
        history["val_loss"].append(val_loss)
        history["val_miou"].append(float(val_miou))
        history["val_building_miou"].append(float(val_bmiou))
        
        print(f"\n  Epoch {epoch}/{num_epochs} ({epoch_time:.1f}s)")
        print(f"    Train Loss: {train_loss:.4f}")
        print(f"    Val Loss:   {val_loss:.4f}")
        print(f"    Val mIoU:   {val_miou * 100:.2f}%")
        print(f"    Val Bldg mIoU: {val_bmiou * 100:.2f}%")
        
        # Save best model
        if val_miou > best_miou:
            best_miou = val_miou
            history["best_epoch"] = epoch
            history["best_val_miou"] = float(best_miou)
            
            best_path = os.path.join(cfg["output"]["checkpoint_dir"], "best_model.pth")
            torch.save(model.state_dict(), best_path)
            print(f"    [SAVED] New best model (mIoU: {best_miou * 100:.2f}%) -> {best_path}")
    
    # Save final model
    final_path = os.path.join(cfg["output"]["checkpoint_dir"], "final_model.pth")
    torch.save(model.state_dict(), final_path)
    
    # Save training log
    log_path = cfg["output"]["training_log"]
    with open(log_path, "w") as f:
        json.dump(history, f, indent=2, default=str)
    
    print("\n" + "=" * 60)
    print("TRAINING COMPLETE")
    print("=" * 60)
    print(f"  Best Epoch: {history['best_epoch']}")
    print(f"  Best Val mIoU: {history['best_val_miou'] * 100:.2f}%")
    print(f"  Best Model: {best_path}")
    print(f"  Final Model: {final_path}")
    print(f"  Training Log: {log_path}")
    
    return history


if __name__ == "__main__":
    main()
