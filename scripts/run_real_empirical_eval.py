"""
Complete empirical evaluation of real models on real images.
Zero hardcoding, zero simulation, zero fake numbers.
"""
import os
import sys
import json
import time
import torch
import cv2
import numpy as np
from sklearn.metrics import confusion_matrix, f1_score, precision_score, recall_score, balanced_accuracy_score, accuracy_score

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(os.path.join(ROOT_DIR, "ai-service"))

from app.cv.models import BuildingDamageUNet

device = torch.device("cpu")
mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
std = np.array([0.229, 0.224, 0.225], dtype=np.float32)

def load_tile(tile_info, target_size=(512, 512)):
    pre_bgr = cv2.imread(tile_info["pre_path"])
    post_bgr = cv2.imread(tile_info["post_path"])
    mask = cv2.imread(tile_info["mask_path"], cv2.IMREAD_GRAYSCALE)
    
    if pre_bgr is None:
        pre_bgr = np.zeros((target_size[0], target_size[1], 3), dtype=np.uint8)
    else:
        pre_bgr = cv2.resize(pre_bgr, target_size)
        
    if post_bgr is None:
        post_bgr = np.zeros((target_size[0], target_size[1], 3), dtype=np.uint8)
    else:
        post_bgr = cv2.resize(post_bgr, target_size)
        
    if mask is None:
        mask = np.zeros(target_size, dtype=np.uint8)
    else:
        mask = cv2.resize(mask, target_size, interpolation=cv2.INTER_NEAREST)
        
    pre_rgb = cv2.cvtColor(pre_bgr, cv2.COLOR_BGR2RGB)
    post_rgb = cv2.cvtColor(post_bgr, cv2.COLOR_BGR2RGB)
    
    pre_norm = ((pre_rgb.astype(np.float32) / 255.0) - mean) / std
    post_norm = ((post_rgb.astype(np.float32) / 255.0) - mean) / std
    
    pre_t = np.transpose(pre_norm, (2, 0, 1))
    post_t = np.transpose(post_norm, (2, 0, 1))
    
    pre_post_t = torch.tensor(np.concatenate([pre_t, post_t], axis=0), dtype=torch.float32).unsqueeze(0)
    post_only_t = torch.tensor(post_t, dtype=torch.float32).unsqueeze(0)
    
    return pre_post_t, post_only_t, mask

# Collect Indian tiles
indian_tiles = []
for event in ["chamoli_2021", "fani_2019", "dharali_2025"]:
    event_dir = os.path.join(ROOT_DIR, "data", "india", event)
    pre_dir = os.path.join(event_dir, "processed", "images_pre")
    post_dir = os.path.join(event_dir, "processed", "images_post")
    mask_dir = os.path.join(event_dir, "processed", "masks")
    
    if os.path.exists(pre_dir) and os.path.exists(mask_dir):
        for f in sorted(os.listdir(pre_dir)):
            if f.endswith(("_pre.png", "_pre.jpg")):
                tile_base = f.replace("_pre.png", "").replace("_pre.jpg", "")
                post_name = f.replace("_pre.", "_post.")
                mask_name = tile_base + "_mask.png"
                pre_p = os.path.join(pre_dir, f)
                post_p = os.path.join(post_dir, post_name)
                mask_p = os.path.join(mask_dir, mask_name)
                if os.path.exists(post_p) and os.path.exists(mask_p):
                    indian_tiles.append({
                        "event": event,
                        "tile_id": tile_base,
                        "pre_path": pre_p,
                        "post_path": post_p,
                        "mask_path": mask_p
                    })

# Collect xBD tiles (take a representative sample of 20 pairs for CPU benchmarking)
xbd_tiles = []
xbd_img_dir = os.path.join(ROOT_DIR, "data", "xbd_subset_v2", "images")
xbd_mask_dir = os.path.join(ROOT_DIR, "data", "xbd_subset_v2", "masks")
if os.path.exists(xbd_img_dir) and os.path.exists(xbd_mask_dir):
    for f in sorted(os.listdir(xbd_img_dir))[:40]:
        if f.endswith("_pre_disaster.png"):
            pair_id = f.replace("_pre_disaster.png", "")
            post_f = pair_id + "_post_disaster.png"
            mask_f = pair_id + "_target.png"
            pre_p = os.path.join(xbd_img_dir, f)
            post_p = os.path.join(xbd_img_dir, post_f)
            mask_p = os.path.join(xbd_mask_dir, mask_f)
            if os.path.exists(post_p) and os.path.exists(mask_p):
                xbd_tiles.append({
                    "event": "xbd_held_out",
                    "tile_id": pair_id,
                    "pre_path": pre_p,
                    "post_path": post_p,
                    "mask_path": mask_p
                })

print(f"Loaded {len(indian_tiles)} Indian tiles and {len(xbd_tiles)} xBD test tiles.")

checkpoints_to_test = {
    "exp0_xbd_baseline_pre_post": {
        "path": os.path.join(ROOT_DIR, "ai-service", "models", "unet_resnet34_pre_post.pth"),
        "mode": "pre_post"
    },
    "exp1_india_tuned_v1": {
        "path": os.path.join(ROOT_DIR, "models", "india_v1", "best_model.pth"),
        "mode": "pre_post"
    },
    "exp2_india_tuned_v2": {
        "path": os.path.join(ROOT_DIR, "models", "india_v2", "best_model.pth"),
        "mode": "pre_post"
    }
}

CLASSES = ["background", "no-damage", "minor-damage", "major-damage", "destroyed"]

eval_results = {}

for model_key, model_cfg in checkpoints_to_test.items():
    ckpt_path = model_cfg["path"]
    if not os.path.exists(ckpt_path):
        print(f"Skipping {model_key}: checkpoint not found at {ckpt_path}")
        continue
        
    print(f"\nEvaluating {model_key}...")
    model = BuildingDamageUNet(mode=model_cfg["mode"], num_classes=5)
    model.load_state_dict(torch.load(ckpt_path, map_location="cpu", weights_only=False))
    model.eval()
    
    # Evaluate on Indian dataset
    all_preds = []
    all_gts = []
    latencies = []
    
    event_subsets = {"chamoli_2021": [], "fani_2019": [], "dharali_2025": []}
    
    with torch.no_grad():
        for t in indian_tiles:
            inp_6ch, inp_3ch, gt_mask = load_tile(t)
            inp = inp_6ch if model_cfg["mode"] == "pre_post" else inp_3ch
            
            t0 = time.perf_counter()
            logits = model(inp)
            lat_ms = (time.perf_counter() - t0) * 1000.0
            latencies.append(lat_ms)
            
            probs = torch.softmax(logits, dim=1).squeeze(0).numpy()
            pred_mask = np.argmax(probs, axis=0).astype(np.uint8)
            
            # Subsample 1 in 16 pixels to speed up exact metric calculation across full resolution
            y_pred = pred_mask[::4, ::4].flatten()
            y_true = gt_mask[::4, ::4].flatten()
            
            # Clip GT to valid classes (0..4)
            y_true = np.clip(y_true, 0, 4)
            
            all_preds.extend(y_pred)
            all_gts.extend(y_true)
            
            event_subsets[t["event"]].append((y_pred, y_true))
            
    all_preds = np.array(all_preds)
    all_gts = np.array(all_gts)
    
    # Calculate real metrics
    raw_acc = float(accuracy_score(all_gts, all_preds))
    bal_acc = float(balanced_accuracy_score(all_gts, all_preds))
    macro_f1 = float(f1_score(all_gts, all_preds, average="macro", zero_division=0))
    weighted_f1 = float(f1_score(all_gts, all_preds, average="weighted", zero_division=0))
    
    # Building IoU and Dice (classes 1..4 combined vs 0)
    bldg_pred = (all_preds > 0).astype(np.uint8)
    bldg_true = (all_gts > 0).astype(np.uint8)
    inter = float(np.logical_and(bldg_pred, bldg_true).sum())
    union = float(np.logical_or(bldg_pred, bldg_true).sum())
    bldg_iou = (inter / union) if union > 0 else 0.0
    bldg_dice = (2.0 * inter / (bldg_pred.sum() + bldg_true.sum())) if (bldg_pred.sum() + bldg_true.sum()) > 0 else 0.0
    
    # Per-class metrics
    per_class_f1 = f1_score(all_gts, all_preds, average=None, labels=list(range(5)), zero_division=0).tolist()
    per_class_prec = precision_score(all_gts, all_preds, average=None, labels=list(range(5)), zero_division=0).tolist()
    per_class_rec = recall_score(all_gts, all_preds, average=None, labels=list(range(5)), zero_division=0).tolist()
    
    cm = confusion_matrix(all_gts, all_preds, labels=list(range(5))).tolist()
    
    # Event-specific metrics
    event_metrics = {}
    for ev_name, pairs in event_subsets.items():
        if not pairs:
            continue
        ev_p = np.concatenate([p[0] for p in pairs])
        ev_g = np.concatenate([p[1] for p in pairs])
        event_metrics[ev_name] = {
            "num_tiles": len(pairs),
            "pixel_accuracy": round(float(accuracy_score(ev_g, ev_p)), 4),
            "balanced_accuracy": round(float(balanced_accuracy_score(ev_g, ev_p)), 4),
            "macro_f1": round(float(f1_score(ev_g, ev_p, average="macro", zero_division=0)), 4),
            "weighted_f1": round(float(f1_score(ev_g, ev_p, average="weighted", zero_division=0)), 4),
        }
        
    eval_results[model_key] = {
        "checkpoint": ckpt_path,
        "mode": model_cfg["mode"],
        "num_tiles_evaluated": len(indian_tiles),
        "mean_latency_ms": round(float(np.mean(latencies)), 2),
        "metrics": {
            "pixel_accuracy": round(raw_acc, 4),
            "balanced_accuracy": round(bal_acc, 4),
            "macro_f1": round(macro_f1, 4),
            "weighted_f1": round(weighted_f1, 4),
            "building_iou": round(bldg_iou, 4),
            "building_dice": round(bldg_dice, 4),
            "per_class": {
                CLASSES[i]: {
                    "f1": round(per_class_f1[i], 4),
                    "precision": round(per_class_prec[i], 4),
                    "recall": round(per_class_rec[i], 4)
                } for i in range(5)
            },
            "confusion_matrix": cm,
            "classes": CLASSES
        },
        "by_event": event_metrics
    }
    
    print(f"  Pixel Acc: {raw_acc*100:.2f}% | Balanced Acc: {bal_acc*100:.2f}% | Macro F1: {macro_f1*100:.2f}% | Weighted F1: {weighted_f1*100:.2f}%")
    print(f"  Building IoU: {bldg_iou*100:.2f}% | Building Dice: {bldg_dice*100:.2f}% | Mean Latency: {np.mean(latencies):.1f}ms")
    for i, c in enumerate(CLASSES):
        print(f"    - {c:15s} | Prec: {per_class_prec[i]*100:5.2f}% | Rec: {per_class_rec[i]*100:5.2f}% | F1: {per_class_f1[i]*100:5.2f}%")

# ============================================================
# EVALUATE STAGE 1 BUILDING LOCALIZATION ON REAL TILES
# ============================================================
print("\n" + "=" * 80)
print("EVALUATING STAGE 1 BUILDING LOCALIZATION ON REAL TILES")
print("=" * 80)

from app.cv.stage1_localization import BuildingLocalizationUNet

s1_model_path = os.path.join(ROOT_DIR, "ai-service", "models", "stage1_building_loc_best.pth")
if os.path.exists(s1_model_path):
    s1_model = BuildingLocalizationUNet(in_channels=6)
    s1_model.load_state_dict(torch.load(s1_model_path, map_location="cpu", weights_only=False))
    s1_model.eval()
    
    s1_preds, s1_gts, s1_lats = [], [], []
    with torch.no_grad():
        for t in indian_tiles:
            inp_6ch, _, gt_mask = load_tile(t)
            t0 = time.perf_counter()
            logits = s1_model(inp_6ch)
            s1_lats.append((time.perf_counter() - t0) * 1000.0)
            probs = torch.sigmoid(logits).squeeze().numpy()
            pred_bin = (probs >= 0.5).astype(np.uint8)
            gt_bin = (gt_mask > 0).astype(np.uint8)
            
            s1_preds.extend(pred_bin[::4, ::4].flatten())
            s1_gts.extend(gt_bin[::4, ::4].flatten())
            
    s1_preds = np.array(s1_preds)
    s1_gts = np.array(s1_gts)
    
    s1_acc = float(accuracy_score(s1_gts, s1_preds))
    s1_bal_acc = float(balanced_accuracy_score(s1_gts, s1_preds))
    inter = float(np.logical_and(s1_preds, s1_gts).sum())
    union = float(np.logical_or(s1_preds, s1_gts).sum())
    s1_iou = (inter / union) if union > 0 else 0.0
    s1_dice = (2.0 * inter / (s1_preds.sum() + s1_gts.sum())) if (s1_preds.sum() + s1_gts.sum()) > 0 else 0.0
    s1_prec = float(precision_score(s1_gts, s1_preds, zero_division=0))
    s1_rec = float(recall_score(s1_gts, s1_preds, zero_division=0))
    s1_f1 = float(f1_score(s1_gts, s1_preds, zero_division=0))
    
    eval_results["stage1_building_localization"] = {
        "checkpoint": s1_model_path,
        "mean_latency_ms": round(float(np.mean(s1_lats)), 2),
        "metrics": {
            "pixel_accuracy": round(s1_acc, 4),
            "balanced_accuracy": round(s1_bal_acc, 4),
            "building_iou": round(s1_iou, 4),
            "building_dice": round(s1_dice, 4),
            "building_precision": round(s1_prec, 4),
            "building_recall": round(s1_rec, 4),
            "building_f1": round(s1_f1, 4)
        }
    }
    print(f"Stage 1 Localisation: Pixel Acc={s1_acc*100:.2f}% | Balanced Acc={s1_bal_acc*100:.2f}% | IoU={s1_iou*100:.2f}% | Dice={s1_dice*100:.2f}% | Latency={np.mean(s1_lats):.1f}ms")

# ============================================================
# EVALUATE STAGE 2 DAMAGE CLASSIFIER ON REAL BUILDING CROPS
# ============================================================
print("\n" + "=" * 80)
print("EVALUATING STAGE 2 DAMAGE CLASSIFIER ON REAL BUILDING CROPS")
print("=" * 80)

from app.cv.stage2_damage_classification import SiameseDamageClassifier, DAMAGE_CLASSES

s2_model_path = os.path.join(ROOT_DIR, "ai-service", "models", "stage2_damage_clf_best.pth")
if os.path.exists(s2_model_path):
    s2_model = SiameseDamageClassifier(num_classes=4, pretrained=False)
    s2_model.load_state_dict(torch.load(s2_model_path, map_location="cpu", weights_only=False))
    s2_model.eval()
    
    # Extract real crops from tiles where ground truth buildings exist
    crop_preds, crop_gts, s2_lats = [], [], []
    
    for t in indian_tiles + xbd_tiles:
        pre_bgr = cv2.imread(t["pre_path"])
        post_bgr = cv2.imread(t["post_path"])
        mask = cv2.imread(t["mask_path"], cv2.IMREAD_GRAYSCALE)
        if pre_bgr is None or post_bgr is None or mask is None:
            continue
            
        pre_rgb = cv2.cvtColor(cv2.resize(pre_bgr, (512, 512)), cv2.COLOR_BGR2RGB)
        post_rgb = cv2.cvtColor(cv2.resize(post_bgr, (512, 512)), cv2.COLOR_BGR2RGB)
        mask_512 = cv2.resize(mask, (512, 512), interpolation=cv2.INTER_NEAREST)
        
        # Find contours of buildings
        bldg_mask = (mask_512 > 0).astype(np.uint8)
        cnts, _ = cv2.findContours(bldg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for cnt in cnts:
            if cv2.contourArea(cnt) < 15:
                continue
            x, y, w, h = cv2.boundingRect(cnt)
            pad = 4
            x0, y0 = max(0, x - pad), max(0, y - pad)
            x1, y1 = min(512, x + w + pad), min(512, y + h + pad)
            
            c_pre = cv2.resize(pre_rgb[y0:y1, x0:x1], (64, 64))
            c_post = cv2.resize(post_rgb[y0:y1, x0:x1], (64, 64))
            
            # Ground truth class: mode of mask within contour
            c_mask = mask_512[y0:y1, x0:x1]
            bldg_pixels = c_mask[c_mask > 0]
            if len(bldg_pixels) == 0:
                continue
            # Map mask class (1..4) to damage class index (0..3)
            true_cls = int(np.bincount(bldg_pixels).argmax()) - 1
            if true_cls < 0 or true_cls > 3:
                continue
                
            c_pre_n = (c_pre.astype(np.float32) / 255.0 - mean) / std
            c_post_n = (c_post.astype(np.float32) / 255.0 - mean) / std
            
            t_pre = torch.tensor(np.transpose(c_pre_n, (2, 0, 1)), dtype=torch.float32).unsqueeze(0)
            t_post = torch.tensor(np.transpose(c_post_n, (2, 0, 1)), dtype=torch.float32).unsqueeze(0)
            
            t0 = time.perf_counter()
            with torch.no_grad():
                logits = s2_model(t_pre, t_post)
                pred_cls = int(torch.argmax(logits, dim=1).item())
            s2_lats.append((time.perf_counter() - t0) * 1000.0)
            
            crop_preds.append(pred_cls)
            crop_gts.append(true_cls)
            
    if crop_preds:
        crop_preds = np.array(crop_preds)
        crop_gts = np.array(crop_gts)
        
        s2_acc = float(accuracy_score(crop_gts, crop_preds))
        s2_bal_acc = float(balanced_accuracy_score(crop_gts, crop_preds))
        s2_macro_f1 = float(f1_score(crop_gts, crop_preds, average="macro", zero_division=0))
        s2_weighted_f1 = float(f1_score(crop_gts, crop_preds, average="weighted", zero_division=0))
        s2_cm = confusion_matrix(crop_gts, crop_preds, labels=[0, 1, 2, 3]).tolist()
        s2_class_f1 = f1_score(crop_gts, crop_preds, average=None, labels=[0, 1, 2, 3], zero_division=0).tolist()
        s2_class_prec = precision_score(crop_gts, crop_preds, average=None, labels=[0, 1, 2, 3], zero_division=0).tolist()
        s2_class_rec = recall_score(crop_gts, crop_preds, average=None, labels=[0, 1, 2, 3], zero_division=0).tolist()
        
        class_names = [DAMAGE_CLASSES[k] if isinstance(DAMAGE_CLASSES, dict) else DAMAGE_CLASSES[k] for k in range(4)]
        eval_results["stage2_damage_classification"] = {
            "checkpoint": s2_model_path,
            "total_crops_evaluated": len(crop_preds),
            "mean_crop_latency_ms": round(float(np.mean(s2_lats)), 2),
            "metrics": {
                "overall_accuracy": round(s2_acc, 4),
                "balanced_accuracy": round(s2_bal_acc, 4),
                "macro_f1": round(s2_macro_f1, 4),
                "weighted_f1": round(s2_weighted_f1, 4),
                "confusion_matrix": {
                    "classes": class_names,
                    "matrix": s2_cm
                },
                "per_class": {
                    class_names[i]: {
                        "f1": round(s2_class_f1[i], 4),
                        "precision": round(s2_class_prec[i], 4),
                        "recall": round(s2_class_rec[i], 4)
                    } for i in range(4)
                }
            }
        }
        print(f"Stage 2 Damage Clf: Total Crops={len(crop_preds)} | Acc={s2_acc*100:.2f}% | Balanced Acc={s2_bal_acc*100:.2f}% | Macro F1={s2_macro_f1*100:.2f}% | Weighted F1={s2_weighted_f1*100:.2f}%")
        print("Confusion Matrix:")
        print(np.array(s2_cm))
        for i, c_name in enumerate(class_names):
            print(f"  - {c_name:15s} | Prec: {s2_class_prec[i]*100:5.2f}% | Rec: {s2_class_rec[i]*100:5.2f}% | F1: {s2_class_f1[i]*100:5.2f}%")

out_json = os.path.join(ROOT_DIR, "outputs", "india_evaluation", "real_empirical_evaluation_results.json")
with open(out_json, "w", encoding="utf-8") as f:
    json.dump(eval_results, f, indent=2)

print(f"\nSaved raw empirical evaluation results to: {out_json}")

