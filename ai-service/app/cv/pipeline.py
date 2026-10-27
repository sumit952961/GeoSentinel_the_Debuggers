"""
============================================================
Disaster Management System — Two-Stage End-to-End CV Pipeline
============================================================

Combines:
  - Stage 1: Pre+Post U-Net ResNet34 Building Localization
  - Stage 2: Siamese ResNet18 Multi-Temporal Damage Classifier
  - Polygon Extraction -> Shapely Vectorization -> GeoJSON FeatureCollection
"""

import os
import sys
import time
import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from shapely.geometry import Polygon, mapping

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.append(os.path.join(ROOT_DIR, "ai-service"))

import segmentation_models_pytorch as smp
from app.cv.stage1_localization import BuildingLocalizationUNet
from app.cv.stage2_damage_classification import SiameseDamageClassifier, DAMAGE_CLASSES
from app.cv.stage2_benchmark import SiameseResNet
from app.cv.model_registry import get_model_entry

MODELS_DIR = os.path.join(ROOT_DIR, "ai-service", "models")
STAGE1_MODEL_PATH = os.path.join(MODELS_DIR, "stage1_building_loc_best.pth")
STAGE2_MODEL_PATH = os.path.join(MODELS_DIR, "stage2_damage_clf_best.pth")


class TwoStageDisasterPipeline:
    def __init__(self, model_version="dras_india_v3", device="cpu"):
        self.device = torch.device(device)
        self.entry = get_model_entry(model_version)
        self.model_version = self.entry["model_version"]
        self.mean = np.array(self.entry.get("mean", [0.485, 0.456, 0.406]), dtype=np.float32)
        self.std = np.array(self.entry.get("std", [0.229, 0.224, 0.225]), dtype=np.float32)
        
        # 1. Load Stage 1 Localization Model
        s1_cfg = self.entry["stage1"]
        self.s1_path = s1_cfg["checkpoint_path"]
        self.s1_rel_path = s1_cfg["relative_path"]
        self.s1_arch = f"{s1_cfg['architecture']} ({s1_cfg.get('encoder', '')})"
        
        if s1_cfg["architecture"] == "U-Net++":
            self.stage1 = smp.UnetPlusPlus(
                encoder_name=s1_cfg["encoder"],
                encoder_weights=None,
                in_channels=s1_cfg["in_channels"],
                classes=s1_cfg["classes"],
                activation=None
            )
        else:
            self.stage1 = BuildingLocalizationUNet(in_channels=s1_cfg["in_channels"])
            
        if os.path.exists(self.s1_path):
            data = torch.load(self.s1_path, map_location=self.device, weights_only=False)
            state_dict = data["model_state_dict"] if isinstance(data, dict) and "model_state_dict" in data else data
            self.stage1.load_state_dict(state_dict)
            print(f"[Pipeline] Loaded Stage 1 Localization weights from {self.s1_rel_path}")
        else:
            print(f"[Pipeline] Warning: Stage 1 checkpoint not found at {self.s1_path}")
            
        self.stage1.to(self.device)
        self.stage1.eval()
        
        # 2. Load Stage 2 Damage Classifier
        s2_cfg = self.entry.get("stage2")
        if s2_cfg:
            self.s2_path = s2_cfg["checkpoint_path"]
            self.s2_rel_path = s2_cfg["relative_path"]
            self.s2_arch = f"{s2_cfg['architecture']} ({s2_cfg.get('backbone', '')})"
            
            if s2_cfg["architecture"] == "SiameseResNet":
                self.stage2 = SiameseResNet(backbone=s2_cfg["backbone"], num_classes=s2_cfg["num_classes"])
            else:
                self.stage2 = SiameseDamageClassifier(num_classes=s2_cfg["num_classes"], pretrained=False)
                
            if os.path.exists(self.s2_path):
                data2 = torch.load(self.s2_path, map_location=self.device, weights_only=False)
                state_dict2 = data2["model_state_dict"] if isinstance(data2, dict) and "model_state_dict" in data2 else data2
                self.stage2.load_state_dict(state_dict2)
                print(f"[Pipeline] Loaded Stage 2 Damage Classifier weights from {self.s2_rel_path}")
            else:
                print(f"[Pipeline] Warning: Stage 2 checkpoint not found at {self.s2_path}")
                
            self.stage2.to(self.device)
            self.stage2.eval()
        else:
            self.stage2 = None
            self.s2_path = None
            self.s2_rel_path = "none"
            self.s2_arch = "none"

    def predict_pair(self, pre_rgb, post_rgb, bldg_threshold=0.5, crop_size=(64, 64), min_area=15, padding=8, base_lat=None, base_lon=None):
        """
        Runs the complete Two-Stage inference pipeline on a paired pre/post disaster tile.
        
        pre_rgb: (H, W, 3) uint8 numpy array (RGB)
        post_rgb: (H, W, 3) uint8 numpy array (RGB)
        base_lat: optional geographic latitude anchor for EPSG:4326 output
        base_lon: optional geographic longitude anchor for EPSG:4326 output
        
        Returns: (GeoJSON FeatureCollection dict)
        """
        t0_total = time.perf_counter()
        orig_h, orig_w, _ = pre_rgb.shape
        
        # 1. Resize to (512, 512) for Stage 1 Localization
        t_size = (512, 512)
        pre_s1 = cv2.resize(pre_rgb, t_size, interpolation=cv2.INTER_LINEAR)
        post_s1 = cv2.resize(post_rgb, t_size, interpolation=cv2.INTER_LINEAR)
        
        # Normalize
        pre_norm = (pre_s1.astype(np.float32) / 255.0 - self.mean) / self.std
        post_norm = (post_s1.astype(np.float32) / 255.0 - self.mean) / self.std
        
        pre_t = np.transpose(pre_norm, (2, 0, 1))
        post_t = np.transpose(post_norm, (2, 0, 1))
        input_6ch = torch.tensor(np.concatenate([pre_t, post_t], axis=0), dtype=torch.float32).unsqueeze(0).to(self.device)
        
        # Stage 1 Inference
        t0_s1 = time.perf_counter()
        with torch.no_grad():
            logits_s1 = self.stage1(input_6ch)
            prob_mask_s1 = torch.sigmoid(logits_s1).squeeze().cpu().numpy()
        dt_s1_ms = (time.perf_counter() - t0_s1) * 1000.0
        
        # Threshold & resize binary mask back to original resolution
        bin_mask_512 = (prob_mask_s1 >= bldg_threshold).astype(np.uint8)
        bin_mask_orig = cv2.resize(bin_mask_512, (orig_w, orig_h), interpolation=cv2.INTER_NEAREST)
        
        # Extract polygon contours
        cnts, _ = cv2.findContours(bin_mask_orig, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Extract Stage 2 Crops
        crop_pre_list = []
        crop_post_list = []
        valid_polygons = []
        areas = []
        
        for cnt in cnts:
            area = cv2.contourArea(cnt)
            if area < min_area:
                continue
            x, y, w, h = cv2.boundingRect(cnt)
            x0 = max(0, x - padding)
            y0 = max(0, y - padding)
            x1 = min(orig_w, x + w + padding)
            y1 = min(orig_h, y + h + padding)
            
            if x1 <= x0 or y1 <= y0:
                continue
            crop_pre_raw = pre_rgb[y0:y1, x0:x1]
            crop_post_raw = post_rgb[y0:y1, x0:x1]
            if crop_pre_raw.size == 0 or crop_post_raw.size == 0:
                continue
                
            c_pre = cv2.resize(crop_pre_raw, crop_size, interpolation=cv2.INTER_LINEAR)
            c_post = cv2.resize(crop_post_raw, crop_size, interpolation=cv2.INTER_LINEAR)
            
            c_pre_n = (c_pre.astype(np.float32) / 255.0 - self.mean) / self.std
            c_post_n = (c_post.astype(np.float32) / 255.0 - self.mean) / self.std
            
            crop_pre_list.append(torch.tensor(np.transpose(c_pre_n, (2, 0, 1)), dtype=torch.float32))
            crop_post_list.append(torch.tensor(np.transpose(c_post_n, (2, 0, 1)), dtype=torch.float32))
            
            # Simplify polygon contour slightly for smooth GeoJSON output
            epsilon = 0.015 * cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, epsilon, True)
            if len(approx) >= 3:
                pts = approx.squeeze(1).tolist()
                if pts[0] != pts[-1]:
                    pts.append(pts[0])
                valid_polygons.append(Polygon(pts))
            else:
                valid_polygons.append(None)
            areas.append(area)
            
        # Stage 2 Inference
        dt_s2_ms = 0.0
        features = []
        damage_counts = {"no-damage": 0, "minor-damage": 0, "major-damage": 0, "destroyed": 0}
        
        if len(crop_pre_list) > 0:
            batch_pre = torch.stack(crop_pre_list, dim=0).to(self.device)
            batch_post = torch.stack(crop_post_list, dim=0).to(self.device)
            
            t0_s2 = time.perf_counter()
            with torch.no_grad():
                logits_s2 = self.stage2(batch_pre, batch_post)
                probs_s2 = F.softmax(logits_s2, dim=1).cpu().numpy()
            dt_s2_ms = (time.perf_counter() - t0_s2) * 1000.0
            
            preds_s2 = np.argmax(probs_s2, axis=1)
            
            for i, poly in enumerate(valid_polygons):
                if poly is None or not poly.is_valid:
                    continue
                p_cls = preds_s2[i]
                p_name = DAMAGE_CLASSES[p_cls]
                p_conf = float(probs_s2[i, p_cls])
                p_probs = {DAMAGE_CLASSES[k]: round(float(probs_s2[i, k]), 4) for k in range(4)}
                
                damage_counts[p_name] += 1
                
                if base_lat is not None and base_lon is not None:
                    meters_per_deg = 111320.0
                    deg_per_px_lat = 0.5 / meters_per_deg
                    deg_per_px_lon = 0.5 / (meters_per_deg * np.cos(np.radians(base_lat)))
                    coords = [[
                        [round(float(base_lon + (pt[0] - orig_w / 2.0) * deg_per_px_lon), 7),
                         round(float(base_lat - (pt[1] - orig_h / 2.0) * deg_per_px_lat), 7)]
                        for pt in poly.exterior.coords
                    ]]
                else:
                    coords = [[list(pt) for pt in poly.exterior.coords]]

                features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": coords
                    },
                    "properties": {
                        "building_id": i + 1,
                        "damage_class": p_name,
                        "confidence": round(p_conf, 4),
                        "probabilities": p_probs,
                        "area_pixels": float(areas[i])
                    }
                })
                
        dt_total_ms = (time.perf_counter() - t0_total) * 1000.0
        
        geojson_collection = {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "model_version": self.model_version,
                "pipeline_type": self.entry["pipeline_type"],
                "stage1_checkpoint_loaded": self.s1_rel_path,
                "stage2_checkpoint_loaded": self.s2_rel_path,
                "stage1_architecture": self.s1_arch,
                "stage2_architecture": self.s2_arch,
                "dataset_version": self.entry["dataset_version"],
                "preprocessing_version": self.entry["preprocessing_version"],
                "total_buildings_detected": len(features),
                "damage_summary": damage_counts,
                "damage_breakdown": damage_counts,
                "stage1_latency_ms": round(dt_s1_ms, 2),
                "stage2_latency_ms": round(dt_s2_ms, 2),
                "total_latency_ms": round(dt_total_ms, 2),
                "inference_latency_ms": round(dt_total_ms, 2)
            }
        }
        
        return geojson_collection
