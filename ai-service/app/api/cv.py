"""
============================================================
FastAPI Computer Vision Endpoint Router
============================================================

Endpoints:
  - GET  /api/cv/model-info    -> Returns model status, architecture, and parameter counts
  - POST /api/cv/predict-pair  -> Runs live inference and returns GeoJSON FeatureCollection
"""

import os
import time
import json
import torch
import numpy as np
import cv2
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, Dict, Any

from app.cv.models import BuildingDamageUNet
from app.cv.geojson_converter import mask_to_geojson
from app.cv.pipeline import TwoStageDisasterPipeline
from app.cv.model_registry import get_model_entry, MODEL_REGISTRY

router = APIRouter(prefix="/api/cv", tags=["Computer Vision"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ROOT_DIR = os.path.dirname(BASE_DIR)
MODELS_DIR = os.path.join(BASE_DIR, "models")
DATA_DIR = os.path.join(ROOT_DIR, "data", "xbd_subset_v2")

# Global model cache for fast CPU inference
_model_cache = {}
_two_stage_pipeline = None


def get_two_stage_pipeline():
    global _two_stage_pipeline
    if _two_stage_pipeline is None:
        _two_stage_pipeline = TwoStageDisasterPipeline(model_version="dras_india_v3")
    return _two_stage_pipeline


def get_model(mode="pre_post"):
    if mode not in _model_cache:
        entry = get_model_entry(mode)
        s1_cfg = entry["stage1"]
        weight_path = s1_cfg["checkpoint_path"]
        in_ch = s1_cfg.get("in_channels", 6)
        num_cls = s1_cfg.get("classes", 5)
        
        m_mode = "post_only" if in_ch == 3 else "pre_post"
        model = BuildingDamageUNet(mode=m_mode, num_classes=num_cls)
        
        if os.path.exists(weight_path):
            state_dict = torch.load(weight_path, map_location="cpu", weights_only=False)
            model.load_state_dict(state_dict)
            print(f"[FastAPI CV] Loaded weights from {s1_cfg['relative_path']}")
        else:
            print(f"[FastAPI CV] Warning: Weights file {weight_path} not found. Running with base weights.")
            
        model.eval()
        _model_cache[mode] = (model, entry)
    return _model_cache[mode]


@router.get("/model-info")
def get_model_info():
    """Returns metadata about the trained U-Net ResNet34 models."""
    model_b, _ = get_model(mode="pre_post")
    tot_params, train_params = model_b.count_parameters()
    
    results_path = os.path.join(BASE_DIR, "outputs", "evaluation_results.json")
    results_data = {}
    if os.path.exists(results_path):
        with open(results_path, "r") as f:
            results_data = json.load(f)
            
    return {
        "status": "OPERATIONAL",
        "architecture": "U-Net with ResNet34 Encoder",
        "supported_modes": ["pre_post (6-channel)", "post_only (3-channel)"],
        "total_parameters": tot_params,
        "trainable_parameters": train_params,
        "classes": {
            0: "Background",
            1: "No Damage",
            2: "Minor Damage",
            3: "Major Damage",
            4: "Destroyed"
        },
        "default_model": "unet_resnet34_pre_post.pth",
        "benchmark_summary": {
            "mean_latency_ms": results_data.get("model_b_pre_post", {}).get("latency", {}).get("mean_latency_ms", 443.2),
            "throughput_fps": results_data.get("model_b_pre_post", {}).get("latency", {}).get("tiles_per_second", 2.25),
            "building_macro_f1": results_data.get("model_b_pre_post", {}).get("building_macro_f1", 0.082)
        }
    }


def locate_image_pair(pair_id: str):
    """Locates pre and post disaster images across xBD and Indian scenario directories."""
    # 1. Check direct xBD paths
    candidates = [
        (os.path.join(ROOT_DIR, "data", "xbd_subset_v2", "images", f"{pair_id}_pre_disaster.png"),
         os.path.join(ROOT_DIR, "data", "xbd_subset_v2", "images", f"{pair_id}_post_disaster.png")),
        (os.path.join(ROOT_DIR, "data", "xbd_subset_v1", "images", f"{pair_id}_pre_disaster.png"),
         os.path.join(ROOT_DIR, "data", "xbd_subset_v1", "images", f"{pair_id}_post_disaster.png")),
    ]
    for pre, post in candidates:
        if os.path.exists(post):
            return pre, post

    # 2. Check India disaster scenarios
    india_dir = os.path.join(ROOT_DIR, "data", "india")
    if os.path.exists(india_dir):
        for event in os.listdir(india_dir):
            event_dir = os.path.join(india_dir, event, "processed")
            if os.path.isdir(event_dir):
                post = os.path.join(event_dir, "images_post", f"{pair_id}_post.png")
                pre = os.path.join(event_dir, "images_pre", f"{pair_id}_pre.png")
                if os.path.exists(post):
                    return pre, post
                post2 = os.path.join(event_dir, "images_post", f"{pair_id}.png")
                pre2 = os.path.join(event_dir, "images_pre", f"{pair_id.replace('_post', '_pre')}.png")
                if os.path.exists(post2):
                    return pre2, post2

    # 3. Recursive search
    for root, dirs, files in os.walk(os.path.join(ROOT_DIR, "data")):
        for f in files:
            if f.startswith(pair_id) and ("post" in f) and f.endswith(".png"):
                post = os.path.join(root, f)
                pre = post.replace("images_post", "images_pre").replace("_post", "_pre").replace("post_disaster", "pre_disaster")
                return pre, post

    return None, None


class PredictPairRequest(BaseModel):
    pair_id: str
    mode: Optional[str] = "pre_post"
    base_lat: Optional[float] = None
    base_lon: Optional[float] = None


@router.post("/predict-pair")
def predict_pair(req: PredictPairRequest):
    """
    Performs building damage segmentation on a pair and returns GeoJSON.
    Supports both global xBD pairs and Indian disaster scenarios.
    """
    pre_img_path, post_img_path = locate_image_pair(req.pair_id)
    
    if not post_img_path or not os.path.exists(post_img_path):
        raise HTTPException(status_code=404, detail=f"Image pair not found: {req.pair_id}")
        
    pre_bgr = cv2.imread(pre_img_path) if pre_img_path and os.path.exists(pre_img_path) else None
    post_bgr = cv2.imread(post_img_path)
    
    if pre_bgr is None:
        pre_bgr = np.zeros_like(post_bgr) if post_bgr is not None else np.zeros((1024, 1024, 3), dtype=np.uint8)
    if post_bgr is None:
        raise HTTPException(status_code=400, detail="Could not read post-disaster image")

    # Determine default coordinates based on scenario name if not provided
    base_lat = req.base_lat
    base_lon = req.base_lon
    if base_lat is None or base_lon is None:
        pid_lower = req.pair_id.lower()
        if "chamoli" in pid_lower:
            base_lat, base_lon = 30.4400, 79.6200
        elif "fani" in pid_lower:
            base_lat, base_lon = 19.8100, 85.8300
        elif "dharali" in pid_lower:
            base_lat, base_lon = 31.0300, 78.7500
        else:
            base_lat, base_lon = 34.0522, -118.6850
        
    # Resize to 512x512 for fast CPU inference
    pre_rgb = cv2.cvtColor(cv2.resize(pre_bgr, (512, 512)), cv2.COLOR_BGR2RGB)
    post_rgb = cv2.cvtColor(cv2.resize(post_bgr, (512, 512)), cv2.COLOR_BGR2RGB)
    
    # Normalize
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    
    pre_norm = ((pre_rgb.astype(np.float32) / 255.0) - mean) / std
    post_norm = ((post_rgb.astype(np.float32) / 255.0) - mean) / std
    
    pre_tensor = np.transpose(pre_norm, (2, 0, 1))
    post_tensor = np.transpose(post_norm, (2, 0, 1))
    
    if req.mode in ["dras_india_v3", "dras-india-v3", "v3", "two_stage"]:
        pipeline = get_two_stage_pipeline()
        geojson_fc = pipeline.predict_pair(pre_rgb, post_rgb, base_lat=base_lat, base_lon=base_lon)
        geojson_fc["metadata"]["pair_id"] = req.pair_id
        geojson_fc["metadata"]["mode"] = req.mode
        return geojson_fc
        
    model, entry = get_model(req.mode)
    s1_cfg = entry["stage1"]
    
    if s1_cfg.get("in_channels", 6) == 3:
        input_arr = post_tensor
    else:
        input_arr = np.concatenate([pre_tensor, post_tensor], axis=0)
        
    input_torch = torch.tensor(input_arr, dtype=torch.float32).unsqueeze(0)
    
    t0 = time.perf_counter()
    with torch.no_grad():
        logits = model(input_torch)
        probs = torch.softmax(logits, dim=1).squeeze(0).numpy()
        pred_mask = np.argmax(probs, axis=0)
    latency_ms = (time.perf_counter() - t0) * 1000.0
    
    geojson_fc = mask_to_geojson(pred_mask, probs, base_lat=base_lat, base_lon=base_lon)
    geojson_fc["metadata"]["inference_latency_ms"] = round(latency_ms, 2)
    geojson_fc["metadata"]["pair_id"] = req.pair_id
    geojson_fc["metadata"]["mode"] = req.mode
    geojson_fc["metadata"]["model_version"] = entry["model_version"]
    geojson_fc["metadata"]["pipeline_type"] = entry["pipeline_type"]
    geojson_fc["metadata"]["checkpoint_loaded"] = s1_cfg["relative_path"]
    geojson_fc["metadata"]["dataset_version"] = entry["dataset_version"]
    geojson_fc["metadata"]["preprocessing_version"] = entry["preprocessing_version"]
    
    return geojson_fc
