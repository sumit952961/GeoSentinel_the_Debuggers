"""
============================================================
Disaster Management System — Stage 2: Building Damage Classification
============================================================

Implements:
  1. Building Crop Dataset Extraction from xBD Annotations (No Data Leakage)
  2. Siamese ResNet18 Architecture (Pre + Post + Difference Fusion)
  3. Class-Weighted Cross-Entropy Loss based on actual training split counts
  4. Oracle Evaluation (using Ground-Truth Building Polygons)
  5. End-to-End Evaluation (Stage 1 Localization -> Crop Extraction -> Stage 2 Damage Classifier)
  6. Visual Diagnostics (Pre/Post/Diff crops, GT vs Pred, 4-class Probabilities)
  7. End-to-End GeoJSON Exporter & CPU Latency Benchmark
"""

import os
import sys
import time
import json
import cv2
import numpy as np
import shapely.wkt
from shapely.geometry import Polygon, MultiPolygon
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
import torchvision.models as models
from torchvision.models import resnet18, ResNet18_Weights
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.append(os.path.join(ROOT_DIR, "ai-service"))

from app.cv.dataset import create_disaster_aware_split
from app.cv.stage1_localization import BuildingLocalizationUNet

DATA_DIR = os.path.join(ROOT_DIR, "data", "xbd_subset_v2")
MANIFEST_CSV = os.path.join(DATA_DIR, "manifest.csv")
MODELS_DIR = os.path.join(ROOT_DIR, "ai-service", "models")
OUTPUTS_DIR = os.path.join(ROOT_DIR, "ai-service", "outputs")
STAGE2_VIS_DIR = os.path.join(OUTPUTS_DIR, "stage2_visuals")
STAGE1_MODEL_PATH = os.path.join(MODELS_DIR, "stage1_building_loc_best.pth")
STAGE2_MODEL_PATH = os.path.join(MODELS_DIR, "stage2_damage_clf_best.pth")

os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(OUTPUTS_DIR, exist_ok=True)
os.makedirs(STAGE2_VIS_DIR, exist_ok=True)

DAMAGE_CLASSES = {
    0: "no-damage",
    1: "minor-damage",
    2: "major-damage",
    3: "destroyed"
}
DAMAGE_NAME_TO_ID = {v: k for k, v in DAMAGE_CLASSES.items()}


# ----------------------------------------------------------------------
# 1. Building Crop Extraction and Dataset Construction
# ----------------------------------------------------------------------
class BuildingCropDataset(Dataset):
    """
    Extracts paired pre/post/difference crops from ground-truth building polygons.
    """
    def __init__(self, image_pairs, data_dir, crop_size=(64, 64), padding=8, is_training=True):
        self.crop_size = crop_size
        self.padding = padding
        self.is_training = is_training
        self.samples = []
        
        # ImageNet Normalization Constants
        self.mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        self.std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        
        self._build_dataset(image_pairs, data_dir)

    def _build_dataset(self, image_pairs, data_dir):
        for pair in image_pairs:
            pair_id = pair["pair_id"]
            disaster = pair["disaster"]
            pre_path = os.path.join(data_dir, pair["pre_image"])
            post_path = os.path.join(data_dir, pair["post_image"])
            ann_path = os.path.join(data_dir, pair["annotation"])
            
            if not (os.path.exists(pre_path) and os.path.exists(post_path) and os.path.exists(ann_path)):
                continue
                
            pre_img = cv2.cvtColor(cv2.imread(pre_path), cv2.COLOR_BGR2RGB)
            post_img = cv2.cvtColor(cv2.imread(post_path), cv2.COLOR_BGR2RGB)
            h_img, w_img, _ = pre_img.shape
            
            with open(ann_path, "r") as f:
                ann_data = json.load(f)
                
            features = ann_data.get("features", {}).get("xy", [])
            for feat in features:
                props = feat.get("properties", {})
                subtype = props.get("subtype", "un-classified")
                if subtype not in DAMAGE_NAME_TO_ID:
                    continue
                label_id = DAMAGE_NAME_TO_ID[subtype]
                
                wkt_str = feat.get("wkt", "")
                try:
                    poly = shapely.wkt.loads(wkt_str)
                    if poly.is_empty or not poly.is_valid:
                        poly = poly.buffer(0)
                    minx, miny, maxx, maxy = poly.bounds
                except Exception:
                    continue
                    
                # Apply configurable padding
                x0 = max(0, int(minx) - self.padding)
                y0 = max(0, int(miny) - self.padding)
                x1 = min(w_img, int(maxx) + self.padding)
                y1 = min(h_img, int(maxy) + self.padding)
                
                if (x1 - x0) < 4 or (y1 - y0) < 4:
                    continue
                    
                pre_crop = pre_img[y0:y1, x0:x1]
                post_crop = post_img[y0:y1, x0:x1]
                
                # Resize crops consistently
                pre_resized = cv2.resize(pre_crop, self.crop_size, interpolation=cv2.INTER_LINEAR)
                post_resized = cv2.resize(post_crop, self.crop_size, interpolation=cv2.INTER_LINEAR)
                
                self.samples.append({
                    "pre_crop": pre_resized,
                    "post_crop": post_resized,
                    "label": label_id,
                    "damage_name": subtype,
                    "pair_id": pair_id,
                    "disaster": disaster,
                    "bbox": [x0, y0, x1, y1],
                    "poly_wkt": wkt_str
                })

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        item = self.samples[idx]
        pre = item["pre_crop"].astype(np.float32) / 255.0
        post = item["post_crop"].astype(np.float32) / 255.0
        
        # Absolute Difference Crop: |Pre - Post|
        diff = np.abs(pre - post)
        
        # Optional Data Augmentation for Training (Flips)
        if self.is_training:
            if np.random.rand() > 0.5:
                pre = np.fliplr(pre).copy()
                post = np.fliplr(post).copy()
                diff = np.fliplr(diff).copy()
            if np.random.rand() > 0.5:
                pre = np.flipud(pre).copy()
                post = np.flipud(post).copy()
                diff = np.flipud(diff).copy()
                
        # Normalize
        pre_norm = (pre - self.mean) / self.std
        post_norm = (post - self.mean) / self.std
        diff_norm = (diff - self.mean) / self.std
        
        # HWC to CHW
        pre_t = torch.tensor(np.transpose(pre_norm, (2, 0, 1)), dtype=torch.float32)
        post_t = torch.tensor(np.transpose(post_norm, (2, 0, 1)), dtype=torch.float32)
        diff_t = torch.tensor(np.transpose(diff_norm, (2, 0, 1)), dtype=torch.float32)
        
        return {
            "pre": pre_t,
            "post": post_t,
            "diff": diff_t,
            "label": torch.tensor(item["label"], dtype=torch.long),
            "damage_name": item["damage_name"],
            "pre_raw": item["pre_crop"],
            "post_raw": item["post_crop"],
            "pair_id": item["pair_id"],
            "disaster": item["disaster"],
            "bbox": item["bbox"]
        }


# ----------------------------------------------------------------------
# 2. Siamese ResNet18 Damage Classifier Architecture
# ----------------------------------------------------------------------
class SiameseDamageClassifier(nn.Module):
    """
    Siamese ResNet18 for Multi-Temporal Building Damage Classification:
      - Pre-crop -> ResNet18 Backbone -> f_pre (512-dim)
      - Post-crop -> Shared ResNet18 Backbone -> f_post (512-dim)
      - Difference -> |f_pre - f_post| (512-dim)
      - Concatenation -> [f_pre, f_post, |f_pre - f_post|] (1536-dim)
      - Classifier Head -> 4 Damage Logits
    """
    def __init__(self, num_classes=4, pretrained=True):
        super().__init__()
        weights = ResNet18_Weights.IMAGENET1K_V1 if pretrained else None
        base_resnet = resnet18(weights=weights)
        
        # Feature extractor up to Global Average Pooling (removes final fc layer)
        self.backbone = nn.Sequential(*list(base_resnet.children())[:-1])
        
        # 1536 -> 512 -> 128 -> 4 Classifier Head
        self.classifier = nn.Sequential(
            nn.Linear(512 * 3, 512),
            nn.BatchNorm1d(512),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(512, 128),
            nn.BatchNorm1d(128),
            nn.ReLU(inplace=True),
            nn.Dropout(0.2),
            nn.Linear(128, num_classes)
        )

    def forward(self, pre, post):
        # Extract 512-d feature vectors from shared backbone
        feat_pre = self.backbone(pre).squeeze(-1).squeeze(-1)    # (B, 512)
        feat_post = self.backbone(post).squeeze(-1).squeeze(-1)  # (B, 512)
        
        # Cross-temporal absolute difference feature
        feat_diff = torch.abs(feat_pre - feat_post)              # (B, 512)
        
        # Fuse representations: [Pre, Post, Diff]
        fused = torch.cat([feat_pre, feat_post, feat_diff], dim=1) # (B, 1536)
        
        logits = self.classifier(fused)                         # (B, 4)
        return logits

    def count_parameters(self):
        total = sum(p.numel() for p in self.parameters())
        trainable = sum(p.numel() for p in self.parameters() if p.requires_grad)
        return total, trainable


# ----------------------------------------------------------------------
# 3. Metric Calculations & Confusion Matrix
# ----------------------------------------------------------------------
def compute_classification_metrics(y_true, y_pred, num_classes=4):
    """
    Computes Accuracy, Macro F1, Weighted F1, Per-Class F1/Precision/Recall, and Confusion Matrix.
    """
    y_true = np.array(y_true, dtype=int)
    y_pred = np.array(y_pred, dtype=int)
    total = len(y_true)
    
    acc = np.mean(y_true == y_pred) if total > 0 else 0.0
    cm = np.zeros((num_classes, num_classes), dtype=int)
    for t, p in zip(y_true, y_pred):
        cm[t, p] += 1
        
    per_class = {}
    f1_list = []
    prec_list = []
    rec_list = []
    supports = []
    
    for c in range(num_classes):
        tp = cm[c, c]
        fp = np.sum(cm[:, c]) - tp
        fn = np.sum(cm[c, :]) - tp
        supp = int(np.sum(cm[c, :]))
        supports.append(supp)
        
        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0
        
        per_class[DAMAGE_CLASSES[c]] = {
            "class_id": c,
            "precision": float(prec),
            "recall": float(rec),
            "f1": float(f1),
            "support": supp
        }
        f1_list.append(f1)
        prec_list.append(prec)
        rec_list.append(rec)
        
    macro_f1 = float(np.mean(f1_list))
    macro_prec = float(np.mean(prec_list))
    macro_rec = float(np.mean(rec_list))
    
    # Weighted F1
    total_supp = sum(supports)
    weighted_f1 = float(sum(f1 * s for f1, s in zip(f1_list, supports)) / total_supp) if total_supp > 0 else 0.0
    
    return {
        "accuracy": float(acc),
        "macro_f1": macro_f1,
        "weighted_f1": weighted_f1,
        "macro_precision": macro_prec,
        "macro_recall": macro_rec,
        "per_class": per_class,
        "confusion_matrix": cm.tolist(),
        "total_samples": total
    }


# ----------------------------------------------------------------------
# 4. Training Routine
# ----------------------------------------------------------------------
def train_stage2_classifier(train_loader, val_loader, class_weights, epochs=12, lr=3e-4):
    print("\n" + "=" * 70)
    print("TRAINING STAGE 2: SIAMESE RESNET18 DAMAGE CLASSIFIER")
    print("=" * 70)
    
    model = SiameseDamageClassifier(num_classes=4, pretrained=True)
    tot_params, train_params = model.count_parameters()
    print(f"Model Parameters: {tot_params:,} (Trainable: {train_params:,})")
    print(f"Class Weights applied to Cross-Entropy: {class_weights.numpy().round(3)}")
    
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)
    
    best_val_macro_f1 = -1.0
    best_weights = None
    train_history = []
    val_history = []
    
    t_start = time.time()
    for ep in range(1, epochs + 1):
        ep_start = time.time()
        model.train()
        t_loss = 0.0
        for batch in train_loader:
            pre = batch["pre"]
            post = batch["post"]
            labels = batch["label"]
            
            optimizer.zero_grad()
            logits = model(pre, post)
            loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()
            t_loss += loss.item() * len(labels)
            
        t_loss /= len(train_loader.dataset)
        train_history.append(t_loss)
        scheduler.step()
        
        # Validation
        model.eval()
        v_loss = 0.0
        val_preds = []
        val_targets = []
        with torch.no_grad():
            for batch in val_loader:
                pre = batch["pre"]
                post = batch["post"]
                labels = batch["label"]
                logits = model(pre, post)
                loss = criterion(logits, labels)
                v_loss += loss.item() * len(labels)
                
                preds = torch.argmax(logits, dim=1).cpu().numpy()
                val_preds.extend(preds)
                val_targets.extend(labels.cpu().numpy())
                
        v_loss /= len(val_loader.dataset)
        val_history.append(v_loss)
        
        val_metrics = compute_classification_metrics(val_targets, val_preds)
        ep_dur = time.time() - ep_start
        print(f"  Epoch {ep:02d}/{epochs:02d} ({ep_dur:.1f}s) | Train Loss: {t_loss:.4f} | Val Loss: {v_loss:.4f} | Val Acc: {val_metrics['accuracy']*100:.2f}% | Val Macro-F1: {val_metrics['macro_f1']*100:.2f}% (No: {val_metrics['per_class']['no-damage']['f1']*100:.1f}%, Min: {val_metrics['per_class']['minor-damage']['f1']*100:.1f}%, Maj: {val_metrics['per_class']['major-damage']['f1']*100:.1f}%, Des: {val_metrics['per_class']['destroyed']['f1']*100:.1f}%)")
        
        if val_metrics["macro_f1"] > best_val_macro_f1:
            best_val_macro_f1 = val_metrics["macro_f1"]
            best_weights = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            
    train_duration = time.time() - t_start
    if best_weights is not None:
        model.load_state_dict(best_weights)
        
    torch.save(model.state_dict(), STAGE2_MODEL_PATH)
    print(f"\n[Checkpoint] Saved Best Stage 2 Model to: {STAGE2_MODEL_PATH}")
    
    return model, train_duration, train_history, val_history


# ----------------------------------------------------------------------
# 5. Oracle Evaluation Routine (Protocol A: GT Polygons)
# ----------------------------------------------------------------------
def evaluate_oracle_stage2(model, test_loader):
    print("\n" + "=" * 70)
    print("STAGE 2 ORACLE EVALUATION (Ground-Truth Building Polygons)")
    print("=" * 70)
    model.eval()
    
    test_preds = []
    test_targets = []
    test_probs = []
    latencies = []
    test_items = []
    
    with torch.no_grad():
        for batch in test_loader:
            pre = batch["pre"]
            post = batch["post"]
            labels = batch["label"]
            
            t0 = time.perf_counter()
            logits = model(pre, post)
            dt_ms = ((time.perf_counter() - t0) * 1000.0) / len(labels)
            latencies.extend([dt_ms] * len(labels))
            
            probs = F.softmax(logits, dim=1).cpu().numpy()
            preds = np.argmax(probs, axis=1)
            
            test_preds.extend(preds)
            test_targets.extend(labels.cpu().numpy())
            test_probs.extend(probs)
            
            for i in range(len(labels)):
                test_items.append({
                    "pre_raw": batch["pre_raw"][i].numpy(),
                    "post_raw": batch["post_raw"][i].numpy(),
                    "label": int(labels[i]),
                    "pred": int(preds[i]),
                    "confidence": float(probs[i][preds[i]]),
                    "probs": probs[i].tolist(),
                    "damage_name": DAMAGE_CLASSES[int(labels[i])],
                    "pred_name": DAMAGE_CLASSES[int(preds[i])],
                    "pair_id": batch["pair_id"][i],
                    "bbox": [int(batch["bbox"][0][i]), int(batch["bbox"][1][i]), int(batch["bbox"][2][i]), int(batch["bbox"][3][i])]
                })
                
    metrics = compute_classification_metrics(test_targets, test_preds)
    metrics["mean_latency_ms_per_building"] = float(np.mean(latencies))
    metrics["throughput_buildings_per_sec"] = float(1000.0 / np.mean(latencies))
    
    return metrics, test_items


# ----------------------------------------------------------------------
# 6. End-to-End Evaluation Routine (Protocol B: Stage 1 Localization -> Stage 2)
# ----------------------------------------------------------------------
def evaluate_end_to_end(stage1_model, stage2_model, test_pairs, data_dir, crop_size=(64, 64)):
    print("\n" + "=" * 70)
    print("STAGE 2 END-TO-END EVALUATION (Stage 1 Detected Polygons -> Damage Clf)")
    print("=" * 70)
    stage1_model.eval()
    stage2_model.eval()
    
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    
    total_gt_buildings = 0
    total_pred_buildings = 0
    matched_correct_damage = 0
    matched_total = 0
    
    tile_benchmark = []
    geojson_features = []
    
    with torch.no_grad():
        for pair in test_pairs:
            pair_id = pair["pair_id"]
            pre_path = os.path.join(data_dir, pair["pre_image"])
            post_path = os.path.join(data_dir, pair["post_image"])
            ann_path = os.path.join(data_dir, pair["annotation"])
            
            pre_img = cv2.cvtColor(cv2.imread(pre_path), cv2.COLOR_BGR2RGB)
            post_img = cv2.cvtColor(cv2.imread(post_path), cv2.COLOR_BGR2RGB)
            h_img, w_img, _ = pre_img.shape
            
            # Load GT polygons for matching
            with open(ann_path, "r") as f:
                ann_data = json.load(f)
            gt_features = []
            for feat in ann_data.get("features", {}).get("xy", []):
                subtype = feat.get("properties", {}).get("subtype", "un-classified")
                if subtype in DAMAGE_NAME_TO_ID:
                    try:
                        p = shapely.wkt.loads(feat.get("wkt", ""))
                        if p.is_valid and not p.is_empty:
                            gt_features.append({"poly": p, "label": DAMAGE_NAME_TO_ID[subtype], "subtype": subtype})
                    except Exception:
                        pass
            total_gt_buildings += len(gt_features)
            
            # 1. Stage 1 Localization Inference
            t0_tile = time.perf_counter()
            pre_norm = (pre_img.astype(np.float32) / 255.0 - mean) / std
            post_norm = (post_img.astype(np.float32) / 255.0 - mean) / std
            pre_t = np.transpose(pre_norm, (2, 0, 1))
            post_t = np.transpose(post_norm, (2, 0, 1))
            input_6ch = torch.tensor(np.concatenate([pre_t, post_t], axis=0), dtype=torch.float32).unsqueeze(0)
            
            t0_s1 = time.perf_counter()
            logits_s1 = stage1_model(input_6ch)
            dt_s1_ms = (time.perf_counter() - t0_s1) * 1000.0
            
            pred_mask = (torch.sigmoid(logits_s1).squeeze().cpu().numpy() >= 0.5).astype(np.uint8)
            cnts, _ = cv2.findContours(pred_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # 2. Stage 2 Damage Classification Inference
            detected_rois = []
            crop_pre_list = []
            crop_post_list = []
            poly_objs = []
            
            for cnt in cnts:
                if cv2.contourArea(cnt) < 15:
                    continue
                x, y, w, h = cv2.boundingRect(cnt)
                x0 = max(0, x - 8)
                y0 = max(0, y - 8)
                x1 = min(w_img, x + w + 8)
                y1 = min(h_img, y + h + 8)
                
                c_pre = cv2.resize(pre_img[y0:y1, x0:x1], crop_size, interpolation=cv2.INTER_LINEAR)
                c_post = cv2.resize(post_img[y0:y1, x0:x1], crop_size, interpolation=cv2.INTER_LINEAR)
                
                c_pre_norm = (c_pre.astype(np.float32) / 255.0 - mean) / std
                c_post_norm = (c_post.astype(np.float32) / 255.0 - mean) / std
                
                crop_pre_list.append(torch.tensor(np.transpose(c_pre_norm, (2, 0, 1)), dtype=torch.float32))
                crop_post_list.append(torch.tensor(np.transpose(c_post_norm, (2, 0, 1)), dtype=torch.float32))
                
                # Convert contour to Polygon
                if len(cnt) >= 3:
                    pts = cnt.squeeze(1).tolist()
                    if pts[0] != pts[-1]:
                        pts.append(pts[0])
                    poly_objs.append(Polygon(pts))
                else:
                    poly_objs.append(None)
                    
            dt_s2_ms = 0.0
            pred_damages = []
            pred_confidences = []
            pred_probs_list = []
            
            if len(crop_pre_list) > 0:
                batch_pre = torch.stack(crop_pre_list, dim=0)
                batch_post = torch.stack(crop_post_list, dim=0)
                
                t0_s2 = time.perf_counter()
                logits_s2 = stage2_model(batch_pre, batch_post)
                dt_s2_ms = (time.perf_counter() - t0_s2) * 1000.0
                
                probs_s2 = F.softmax(logits_s2, dim=1).cpu().numpy()
                preds_s2 = np.argmax(probs_s2, axis=1)
                
                pred_damages = preds_s2.tolist()
                pred_confidences = [float(probs_s2[i, preds_s2[i]]) for i in range(len(preds_s2))]
                pred_probs_list = probs_s2.tolist()
                
            total_tile_ms = (time.perf_counter() - t0_tile) * 1000.0
            num_bldgs = len(crop_pre_list)
            total_pred_buildings += num_bldgs
            
            tile_benchmark.append({
                "pair_id": pair_id,
                "buildings_detected": num_bldgs,
                "stage1_loc_ms": dt_s1_ms,
                "stage2_clf_ms": dt_s2_ms,
                "total_tile_ms": total_tile_ms,
                "per_building_ms": dt_s2_ms / num_bldgs if num_bldgs > 0 else 0.0
            })
            
            # Match predicted polygons to Ground Truth for End-to-End Metric
            for i, p_poly in enumerate(poly_objs):
                if p_poly is None or not p_poly.is_valid:
                    continue
                p_label = pred_damages[i]
                p_conf = pred_confidences[i]
                p_probs = pred_probs_list[i]
                
                # GeoJSON Feature
                geojson_features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[list(pt) for pt in p_poly.exterior.coords]]
                    },
                    "properties": {
                        "pair_id": pair_id,
                        "damage_class": DAMAGE_CLASSES[p_label],
                        "confidence": round(p_conf, 4),
                        "probabilities": {DAMAGE_CLASSES[k]: round(p_probs[k], 4) for k in range(4)}
                    }
                })
                
                # Spatial matching with GT
                best_iou = 0.0
                best_gt_label = -1
                for gt in gt_features:
                    gt_poly = gt["poly"]
                    if gt_poly.intersects(p_poly):
                        inter = gt_poly.intersection(p_poly).area
                        union = gt_poly.area + p_poly.area - inter
                        iou = inter / union if union > 0 else 0.0
                        if iou > best_iou:
                            best_iou = iou
                            best_gt_label = gt["label"]
                            
                if best_iou >= 0.3:
                    matched_total += 1
                    if best_gt_label == p_label:
                        matched_correct_damage += 1
                        
    e2e_acc_on_detected = matched_correct_damage / matched_total if matched_total > 0 else 0.0
    
    # Save End-to-End GeoJSON
    geojson_out = {
        "type": "FeatureCollection",
        "features": geojson_features
    }
    geojson_path = os.path.join(OUTPUTS_DIR, "stage2_end_to_end_predictions.geojson")
    with open(geojson_path, "w") as f:
        json.dump(geojson_out, f, indent=2)
        
    return {
        "total_gt_buildings": total_gt_buildings,
        "total_detected_buildings": total_pred_buildings,
        "matched_detections": matched_total,
        "matched_correct_damage": matched_correct_damage,
        "damage_accuracy_on_matched_buildings": float(e2e_acc_on_detected),
        "mean_stage1_latency_ms": float(np.mean([t["stage1_loc_ms"] for t in tile_benchmark])),
        "mean_stage2_latency_ms": float(np.mean([t["stage2_clf_ms"] for t in tile_benchmark])),
        "mean_total_tile_latency_ms": float(np.mean([t["total_tile_ms"] for t in tile_benchmark])),
        "mean_per_building_ms": float(np.mean([t["per_building_ms"] for t in tile_benchmark if t["buildings_detected"] > 0])),
        "tile_benchmarks": tile_benchmark,
        "geojson_file": geojson_path
    }


# ----------------------------------------------------------------------
# 7. Visual Diagnostics Generator
# ----------------------------------------------------------------------
def generate_stage2_visual_diagnostics(test_items, save_dir):
    print(f"\n[Visualizer] Generating Stage 2 visual diagnostic panels in {save_dir}...")
    
    # Select 2 samples per class + 4 failure samples
    selected = []
    by_class = {c: [] for c in range(4)}
    failures = []
    
    for item in test_items:
        if item["label"] == item["pred"]:
            by_class[item["label"]].append(item)
        else:
            failures.append(item)
            
    for c in range(4):
        selected.extend(by_class[c][:2])
    selected.extend(failures[:4])
    
    for idx, s in enumerate(selected):
        pre = s["pre_raw"]
        post = s["post_raw"]
        diff = cv2.absdiff(pre, post)
        
        gt_name = s["damage_name"]
        pred_name = s["pred_name"]
        conf = s["confidence"]
        probs = s["probs"]
        is_correct = (s["label"] == s["pred"])
        
        fig, axes = plt.subplots(1, 4, figsize=(18, 4.5))
        
        # 1. Pre Crop
        axes[0].imshow(pre)
        axes[0].set_title(f"Pre-Disaster Crop\n({s['pair_id']})", fontsize=11, fontweight="bold")
        axes[0].axis("off")
        
        # 2. Post Crop
        axes[1].imshow(post)
        axes[1].set_title("Post-Disaster Crop", fontsize=11, fontweight="bold")
        axes[1].axis("off")
        
        # 3. Diff Crop
        axes[2].imshow(diff)
        axes[2].set_title("Absolute Difference\n|Pre - Post|", fontsize=11, fontweight="bold")
        axes[2].axis("off")
        
        # 4. Probabilities Bar Chart
        class_names = ["No Damage", "Minor", "Major", "Destroyed"]
        colors = ["#2ecc71", "#f1c40f", "#e67e22", "#e74c3c"]
        y_pos = np.arange(len(class_names))
        
        bars = axes[3].barh(y_pos, probs, color=colors, alpha=0.85, edgecolor="black")
        axes[3].set_yticks(y_pos)
        axes[3].set_yticklabels(class_names, fontsize=10, fontweight="bold")
        axes[3].set_xlim(0, 1.0)
        axes[3].set_xlabel("Predicted Probability", fontsize=10)
        
        title_color = "green" if is_correct else "red"
        status_str = "CORRECT" if is_correct else "MISCLASSIFIED"
        axes[3].set_title(f"[{status_str}]\nGT: {gt_name.upper()} | Pred: {pred_name.upper()} ({conf*100:.1f}%)",
                          fontsize=11, fontweight="bold", color=title_color)
        
        for bar in bars:
            w = bar.get_width()
            axes[3].text(w + 0.02, bar.get_y() + bar.get_height()/2, f"{w*100:.1f}%",
                         va="center", ha="left", fontsize=9, fontweight="bold")
            
        plt.tight_layout()
        out_name = f"stage2_sample_{idx+1:02d}_{gt_name}_pred_{pred_name}.png"
        plt.savefig(os.path.join(save_dir, out_name), dpi=120, bbox_inches="tight")
        plt.close(fig)
        
    print(f"  [Saved] All visual diagnostic figures saved to: {save_dir}")


# ----------------------------------------------------------------------
# 8. Main Stage 2 Pipeline Execution
# ----------------------------------------------------------------------
def main():
    print("=" * 80)
    print("STAGE 2: BUILDING DAMAGE CLASSIFICATION PIPELINE")
    print("=" * 80)
    
    # 1. Load Disaster-Stratified Pair-Level Split
    train_pairs, val_pairs, test_pairs = create_disaster_aware_split(MANIFEST_CSV)
    
    print("\n[Step 1] Constructing Building Crop Datasets from xBD Annotations...")
    train_crops = BuildingCropDataset(train_pairs, DATA_DIR, crop_size=(64, 64), padding=8, is_training=True)
    val_crops = BuildingCropDataset(val_pairs, DATA_DIR, crop_size=(64, 64), padding=8, is_training=False)
    test_crops = BuildingCropDataset(test_pairs, DATA_DIR, crop_size=(64, 64), padding=8, is_training=False)
    
    print(f"  - Train Set: {len(train_crops):,} buildings across {len(train_pairs)} image pairs")
    print(f"  - Val Set:   {len(val_crops):,} buildings across {len(val_pairs)} image pairs")
    print(f"  - Test Set:  {len(test_crops):,} buildings across {len(test_pairs)} image pairs")
    
    # 2. Count class distributions in training set strictly
    train_labels = [s["label"] for s in train_crops.samples]
    train_counts = np.bincount(train_labels, minlength=4)
    print(f"\n[Step 2] Training Set Class Distribution:")
    for c in range(4):
        print(f"  Class {c} ({DAMAGE_CLASSES[c]}): {train_counts[c]:,} buildings ({train_counts[c]/len(train_labels)*100:.2f}%)")
        
    # Class weights for Cross Entropy: w_c = N_total / (4 * N_c)
    total_train = len(train_labels)
    raw_weights = total_train / (4.0 * train_counts.astype(np.float32))
    class_weights_t = torch.tensor(raw_weights, dtype=torch.float32)
    
    train_loader = DataLoader(train_crops, batch_size=32, shuffle=True)
    val_loader = DataLoader(val_crops, batch_size=32, shuffle=False)
    test_loader = DataLoader(test_crops, batch_size=32, shuffle=False)
    
    if os.path.exists(STAGE2_MODEL_PATH) and ("--retrain" not in sys.argv):
        print(f"\n[Step 3] Found existing trained Stage 2 checkpoint at {STAGE2_MODEL_PATH}, loading weights...")
        model = SiameseDamageClassifier(num_classes=4, pretrained=False)
        model.load_state_dict(torch.load(STAGE2_MODEL_PATH, weights_only=True))
        train_dur = 0.0
    else:
        # 3. Train Siamese ResNet18 Classifier
        model, train_dur, train_hist, val_hist = train_stage2_classifier(
            train_loader, val_loader, class_weights_t, epochs=12, lr=3e-4
        )
    
    # 4. Oracle Evaluation (Protocol A)
    oracle_metrics, test_items = evaluate_oracle_stage2(model, test_loader)
    print("\n[ORACLE EVALUATION RESULTS]")
    print(f"  Overall Accuracy:   {oracle_metrics['accuracy']*100:.2f}%")
    print(f"  Macro F1-Score:     {oracle_metrics['macro_f1']*100:.2f}%")
    print(f"  Weighted F1-Score:  {oracle_metrics['weighted_f1']*100:.2f}%")
    print(f"  Macro Precision:    {oracle_metrics['macro_precision']*100:.2f}%")
    print(f"  Macro Recall:       {oracle_metrics['macro_recall']*100:.2f}%")
    print(f"  Mean Latency / Bldg:{oracle_metrics['mean_latency_ms_per_building']:.2f} ms ({oracle_metrics['throughput_buildings_per_sec']:.1f} bldgs/sec)")
    print("\n  Per-Class Oracle Metrics:")
    for c_name, m in oracle_metrics["per_class"].items():
        print(f"    - {c_name.ljust(14)}: F1={m['f1']*100:.2f}% | Prec={m['precision']*100:.2f}% | Rec={m['recall']*100:.2f}% | Support={m['support']:,}")
    print("\n  Confusion Matrix (Rows=GT, Cols=Pred):")
    print(np.array(oracle_metrics["confusion_matrix"]))
    
    # 5. Visual Diagnostics Generation
    generate_stage2_visual_diagnostics(test_items, STAGE2_VIS_DIR)
    
    # 6. End-to-End Evaluation (Protocol B)
    print("\n[Step 5] Loading Stage 1 Localization Checkpoint for End-to-End Pipeline...")
    stage1_model = BuildingLocalizationUNet(in_channels=6)
    stage1_model.load_state_dict(torch.load(STAGE1_MODEL_PATH, weights_only=True))
    
    e2e_results = evaluate_end_to_end(stage1_model, model, test_pairs, DATA_DIR)
    print("\n[END-TO-END EVALUATION RESULTS]")
    print(f"  Total Ground Truth Buildings:      {e2e_results['total_gt_buildings']:,}")
    print(f"  Total Stage 1 Detected Buildings:  {e2e_results['total_detected_buildings']:,}")
    print(f"  Spatially Matched Buildings:       {e2e_results['matched_detections']:,}")
    print(f"  Damage Accuracy on Localized Bldgs:{e2e_results['damage_accuracy_on_matched_buildings']*100:.2f}%")
    print(f"  Mean Stage 1 Tile Latency:         {e2e_results['mean_stage1_latency_ms']:.1f} ms")
    print(f"  Mean Stage 2 Tile Latency:         {e2e_results['mean_stage2_latency_ms']:.1f} ms")
    print(f"  Mean Total Tile End-to-End Latency:{e2e_results['mean_total_tile_latency_ms']:.1f} ms")
    print(f"  Mean Latency Per Building:         {e2e_results['mean_per_building_ms']:.2f} ms")
    print(f"  Generated GeoJSON Predictions:     {e2e_results['geojson_file']}")
    
    # 7. Save Final Comprehensive Report JSON
    stage2_full_results = {
        "dataset": {
            "train_buildings": len(train_crops),
            "val_buildings": len(val_crops),
            "test_buildings": len(test_crops),
            "train_counts": {DAMAGE_CLASSES[c]: int(train_counts[c]) for c in range(4)},
            "class_weights": {DAMAGE_CLASSES[c]: float(raw_weights[c]) for c in range(4)}
        },
        "model": {
            "name": "SiameseResNet18DamageClassifier",
            "total_parameters": model.count_parameters()[0],
            "trainable_parameters": model.count_parameters()[1],
            "crop_size": [64, 64],
            "training_duration_s": round(train_dur, 2)
        },
        "oracle_evaluation": oracle_metrics,
        "end_to_end_evaluation": e2e_results
    }
    
    res_path = os.path.join(OUTPUTS_DIR, "stage2_damage_classification_results.json")
    with open(res_path, "w") as f:
        json.dump(stage2_full_results, f, indent=2)
        
    print("\n" + "=" * 80)
    print(f"Stage 2 Pipeline Successfully Completed! Results saved to: {res_path}")
    print("=" * 80)


if __name__ == "__main__":
    main()
