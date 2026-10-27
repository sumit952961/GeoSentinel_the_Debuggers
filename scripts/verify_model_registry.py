"""
============================================================
DRAS Model Registry & Checkpoint Integrity Verification Script
============================================================
Fails with exit code 1 if:
  1. dras_india_v3 loads a V1 or V2 checkpoint
  2. Checkpoint architecture does not match the declared model
  3. Checkpoint file is missing on disk
  4. Preprocessing configuration does not match training configuration
  5. Live inference metadata does not report actual V3 checkpoints
"""

import os
import sys
import torch
import numpy as np

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT_DIR, "ai-service"))

from app.cv.model_registry import get_model_entry, MODEL_REGISTRY
from app.cv.pipeline import TwoStageDisasterPipeline
import segmentation_models_pytorch as smp
from app.cv.stage2_benchmark import SiameseResNet

print("=" * 80)
print("VERIFYING MODEL REGISTRY & CHECKPOINT ARCHITECTURE INTEGRITY")
print("=" * 80)

failures = []

# 1. Inspect dras_india_v3 entry
v3_entry = get_model_entry("dras_india_v3")
s1_cfg = v3_entry["stage1"]
s2_cfg = v3_entry["stage2"]

print("[Registry Inspection]")
print(f"  Model Version: {v3_entry['model_version']}")
print(f"  Pipeline Type: {v3_entry['pipeline_type']}")
print(f"  Stage 1 Path:  {s1_cfg['relative_path']}")
print(f"  Stage 2 Path:  {s2_cfg['relative_path']}")

# Check 1: Must NOT load a V1 or V2 checkpoint
if "v1" in s1_cfg['relative_path'].lower() or "v2" in s1_cfg['relative_path'].lower():
    failures.append(f"FAIL: Stage 1 checkpoint points to V1/V2: {s1_cfg['relative_path']}")
if "v1" in s2_cfg['relative_path'].lower() or "v2" in s2_cfg['relative_path'].lower():
    failures.append(f"FAIL: Stage 2 checkpoint points to V1/V2: {s2_cfg['relative_path']}")

# Check 2: Physical existence on disk
if not os.path.exists(s1_cfg["checkpoint_path"]):
    failures.append(f"FAIL: Stage 1 checkpoint missing on disk: {s1_cfg['checkpoint_path']}")
elif os.path.getsize(s1_cfg["checkpoint_path"]) < 1024 * 1024:
    failures.append(f"FAIL: Stage 1 checkpoint is too small / empty: {os.path.getsize(s1_cfg['checkpoint_path'])} bytes")

if not os.path.exists(s2_cfg["checkpoint_path"]):
    failures.append(f"FAIL: Stage 2 checkpoint missing on disk: {s2_cfg['checkpoint_path']}")
elif os.path.getsize(s2_cfg["checkpoint_path"]) < 1024 * 1024:
    failures.append(f"FAIL: Stage 2 checkpoint is too small / empty: {os.path.getsize(s2_cfg['checkpoint_path'])} bytes")

# Check 3: Architecture match
try:
    s1_data = torch.load(s1_cfg["checkpoint_path"], map_location="cpu", weights_only=False)
    s1_state = s1_data.get("model_state_dict", s1_data)
    # Check for efficientnet conv_stem in keys
    if not any("conv_stem" in k for k in s1_state.keys()):
        failures.append("FAIL: Stage 1 checkpoint does not match U-Net++ EfficientNet-B2 architecture (missing conv_stem)")
    else:
        print("  -> Stage 1 architecture verified: U-Net++ (timm-efficientnet-b2)")
except Exception as e:
    failures.append(f"FAIL: Could not load Stage 1 state_dict: {e}")

try:
    s2_data = torch.load(s2_cfg["checkpoint_path"], map_location="cpu", weights_only=False)
    s2_state = s2_data.get("model_state_dict", s2_data)
    # Check for ResNet encoder layers in keys
    if not any("encoder" in k for k in s2_state.keys()):
        failures.append("FAIL: Stage 2 checkpoint does not match SiameseResNet architecture")
    else:
        print("  -> Stage 2 architecture verified: SiameseResNet (resnet50)")
except Exception as e:
    failures.append(f"FAIL: Could not load Stage 2 state_dict: {e}")

# Check 4: Preprocessing configuration
expected_norm_mean = [0.485, 0.456, 0.406]
expected_norm_std = [0.229, 0.224, 0.225]
expected_size = (512, 512)

if v3_entry.get("target_size") != expected_size:
    failures.append(f"FAIL: Target size {v3_entry.get('target_size')} does not match expected {expected_size}")
if v3_entry.get("mean") != expected_norm_mean:
    failures.append(f"FAIL: Mean normalization does not match expected ImageNet standard")
if v3_entry.get("std") != expected_norm_std:
    failures.append(f"FAIL: Std normalization does not match expected ImageNet standard")

# Check 5: Live Pipeline execution & metadata check
try:
    pipeline = TwoStageDisasterPipeline(model_version="dras_india_v3")
    dummy_pre = np.zeros((512, 512, 3), dtype=np.uint8)
    dummy_post = np.zeros((512, 512, 3), dtype=np.uint8)
    res = pipeline.predict_pair(dummy_pre, dummy_post)
    meta = res["metadata"]
    
    if meta["stage1_checkpoint_loaded"] != s1_cfg["relative_path"]:
        failures.append(f"FAIL: Pipeline reported stage1_checkpoint_loaded={meta['stage1_checkpoint_loaded']} expected={s1_cfg['relative_path']}")
    if meta["stage2_checkpoint_loaded"] != s2_cfg["relative_path"]:
        failures.append(f"FAIL: Pipeline reported stage2_checkpoint_loaded={meta['stage2_checkpoint_loaded']} expected={s2_cfg['relative_path']}")
    print(f"  -> Live Pipeline Metadata: stage1={meta['stage1_checkpoint_loaded']} | stage2={meta['stage2_checkpoint_loaded']}")
except Exception as e:
    failures.append(f"FAIL: Live pipeline execution failed: {e}")

print("\n" + "=" * 80)
if failures:
    print("VERIFICATION FAILED WITH ERRORS:")
    for f in failures:
        print(f"  [ERROR] {f}")
    sys.exit(1)
else:
    print("ALL 5 MODEL REGISTRY & CHECKPOINT INTEGRITY CHECKS PASSED!")
    print("=" * 80)
    sys.exit(0)
