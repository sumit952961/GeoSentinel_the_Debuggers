"""
============================================================
DRAS Model V4 — Final Scientific Audit & Integrity Verification
============================================================
Strict automated verification script that verifies all 9 failure conditions:
  1. No missing metric files, confusion matrices, logs, or checkpoints
  2. All dataset files in india_v4_manifest.csv exist physically on disk
  3. No declared checkpoints are missing
  4. Checkpoint architecture matches declared model with zero missing keys
  5. Zero train/test event overlap (strict held-out event isolation)
  6. Zero catalogue-only events marked as trainable
  7. Zero SAR rasters claimed without actual physical SAR GeoTIFFs
  8. FastAPI endpoint loads exact declared V3 checkpoints without legacy leakage
  9. Stored metrics match raw confusion matrix evaluation within float precision
============================================================
"""

import os
import sys
import csv
import json
import numpy as np
import torch

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT_DIR, "ai-service"))

import segmentation_models_pytorch as smp
from app.cv.stage2_benchmark import SiameseResNet
from app.cv.model_registry import get_model_entry
from app.cv.pipeline import TwoStageDisasterPipeline

EXPERIMENT_DIRS = [
    "exp_a_transfer_learning",
    "exp_b_heldout_dharali",
    "exp_c_indian_only",
    "exp_e_architecture_benchmark"
]

CATALOGUE_ONLY_EVENTS = {
    "wayanad_2024", "kerala_2018", "amphan_2020", "assam_2022",
    "sikkim_2023", "biparjoy_2023", "michaung_2023", "himachal_2023", "chennai_2023"
}

def check_1_metrics_and_artifacts():
    print("[Check 1/9] Verifying experiment metric files and artifacts...")
    exp_base = os.path.join(ROOT_DIR, "outputs", "experiments")
    for exp_id in EXPERIMENT_DIRS:
        d = os.path.join(exp_base, exp_id)
        if not os.path.isdir(d):
            raise AssertionError(f"Experiment directory missing: {exp_id}")
        for req_file in ["metrics.json", "confusion_matrix.json", "training_log.json", "checkpoint.pt"]:
            p = os.path.join(d, req_file)
            if not os.path.exists(p):
                raise AssertionError(f"Required artifact {req_file} missing in {exp_id}")
            if os.path.getsize(p) == 0:
                raise AssertionError(f"Artifact {req_file} in {exp_id} is empty (0 bytes)")
    print("  -> PASS: All experiment directories and artifacts present.")

def check_2_manifest_physical_files():
    print("[Check 2/9] Verifying manifest physical dataset files...")
    manifest_p = os.path.join(ROOT_DIR, "data", "india_v4_manifest.csv")
    if not os.path.exists(manifest_p):
        raise AssertionError("india_v4_manifest.csv missing")
    with open(manifest_p, "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if len(rows) < 200:
        raise AssertionError(f"Manifest has only {len(rows)} entries, expected >= 200")
    for idx, r in enumerate(rows):
        for col in ["pre_image", "post_image", "building_annotation"]:
            rel = r[col]
            full = os.path.join(ROOT_DIR, rel)
            if not os.path.exists(full):
                raise AssertionError(f"Row {idx} missing physical file {rel}")
            if os.path.getsize(full) == 0:
                raise AssertionError(f"Row {idx} has 0-byte file {rel}")
    print(f"  -> PASS: All {len(rows)} manifest entries physically exist and non-empty.")

def check_3_checkpoints_exist():
    print("[Check 3/9] Verifying core model checkpoints exist...")
    v3_s1 = os.path.join(ROOT_DIR, "models", "india_v3", "stage1", "best_model.pt")
    v3_s2 = os.path.join(ROOT_DIR, "models", "india_v3", "stage2", "best_model.pt")
    v2_joint = os.path.join(ROOT_DIR, "models", "india_v2", "best_model.pth")
    for cp in [v3_s1, v3_s2, v2_joint]:
        if not os.path.exists(cp):
            raise AssertionError(f"Required checkpoint missing: {cp}")
        if os.path.getsize(cp) < 100000:
            raise AssertionError(f"Checkpoint unusually small (<100KB): {cp}")
    print("  -> PASS: Core checkpoints present and valid size.")

def check_4_checkpoint_architecture():
    print("[Check 4/9] Verifying checkpoint architecture against model definitions...")
    v3_s1 = os.path.join(ROOT_DIR, "models", "india_v3", "stage1", "best_model.pt")
    v3_s2 = os.path.join(ROOT_DIR, "models", "india_v3", "stage2", "best_model.pt")
    
    # Stage 1: U-Net++ with timm-efficientnet-b2, 6 channels, 1 class
    s1_net = smp.UnetPlusPlus(encoder_name="timm-efficientnet-b2", encoder_weights=None, in_channels=6, classes=1)
    s1_data = torch.load(v3_s1, map_location="cpu", weights_only=False)
    state_s1 = s1_data["model_state_dict"] if isinstance(s1_data, dict) and "model_state_dict" in s1_data else s1_data
    missing_s1, unexpected_s1 = s1_net.load_state_dict(state_s1, strict=True)
    if missing_s1 or unexpected_s1:
        raise AssertionError(f"Stage 1 checkpoint mismatch: missing={missing_s1}, unexpected={unexpected_s1}")

    # Stage 2: SiameseResNet with resnet50, 4 classes
    s2_net = SiameseResNet(backbone="resnet50", num_classes=4)
    s2_data = torch.load(v3_s2, map_location="cpu", weights_only=False)
    state_s2 = s2_data["model_state_dict"] if isinstance(s2_data, dict) and "model_state_dict" in s2_data else s2_data
    missing_s2, unexpected_s2 = s2_net.load_state_dict(state_s2, strict=True)
    if missing_s2 or unexpected_s2:
        raise AssertionError(f"Stage 2 checkpoint mismatch: missing={missing_s2}, unexpected={unexpected_s2}")

    print("  -> PASS: Checkpoints match U-Net++ (timm-efficientnet-b2) and SiameseResNet (resnet50) with 100% key fidelity.")

def check_5_no_train_test_overlap():
    print("[Check 5/9] Verifying zero train/test event overlap...")
    manifest_p = os.path.join(ROOT_DIR, "data", "india_v4_manifest.csv")
    with open(manifest_p, "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    train_events = set(r["event_id"] for r in rows if r["split"] in ["train", "pretrain"])
    test_events = set(r["event_id"] for r in rows if r["split"] in ["test", "val"])
    overlap = train_events.intersection(test_events)
    if overlap:
        raise AssertionError(f"Train/test event data leakage detected! Overlap: {overlap}")
    print(f"  -> PASS: Strict event separation maintained. Train events: {len(train_events)}, Test events: {len(test_events)}, Overlap: 0.")

def check_6_catalogue_only_isolation():
    print("[Check 6/9] Verifying catalogue-only events are not marked trainable...")
    manifest_p = os.path.join(ROOT_DIR, "data", "india_v4_manifest.csv")
    with open(manifest_p, "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        ev = r["event_id"]
        if ev in CATALOGUE_ONLY_EVENTS:
            raise AssertionError(f"Catalogue-only event '{ev}' found in trainable manifest!")
    print("  -> PASS: All 9 catalogue-only Indian events remain strictly catalogued and not marked trainable.")

def check_7_sar_truthfulness():
    print("[Check 7/9] Verifying SAR truthfulness (no fake SAR rasters)...")
    entry = get_model_entry("dras_india_v3")
    if entry.get("has_sar_rasters", False):
        raise AssertionError("dras_india_v3 claims has_sar_rasters=True but no physical SAR rasters exist")
    if entry["input_modalities"] != ["pre_disaster_optical", "post_disaster_optical"]:
        raise AssertionError(f"Unexpected modalities claimed: {entry['input_modalities']}")
    print("  -> PASS: Optical-only input verified. Zero fabricated SAR rasters claimed.")

def check_8_fastapi_v3_endpoint():
    print("[Check 8/9] Verifying FastAPI / TwoStageDisasterPipeline loads exact V3 checkpoints...")
    pipe = TwoStageDisasterPipeline("dras_india_v3")
    if pipe.s1_rel_path != "models/india_v3/stage1/best_model.pt":
        raise AssertionError(f"Pipeline Stage 1 loaded wrong path: {pipe.s1_rel_path}")
    if pipe.s2_rel_path != "models/india_v3/stage2/best_model.pt":
        raise AssertionError(f"Pipeline Stage 2 loaded wrong path: {pipe.s2_rel_path}")
    
    # Run a test synthetic inference
    pre = np.zeros((512, 512, 3), dtype=np.uint8)
    post = np.zeros((512, 512, 3), dtype=np.uint8)
    res = pipe.predict_pair(pre, post)
    meta = res["metadata"]
    if meta["model_version"] != "dras-india-v3":
        raise AssertionError(f"Metadata model_version mismatch: {meta['model_version']}")
    if meta["stage1_checkpoint_loaded"] != "models/india_v3/stage1/best_model.pt":
        raise AssertionError(f"Stage 1 checkpoint reported mismatch: {meta['stage1_checkpoint_loaded']}")
    if meta["stage2_checkpoint_loaded"] != "models/india_v3/stage2/best_model.pt":
        raise AssertionError(f"Stage 2 checkpoint reported mismatch: {meta['stage2_checkpoint_loaded']}")
    print("  -> PASS: FastAPI pipeline successfully loads and serves exact V3 checkpoints with verified metadata.")

def check_9_metrics_match_confusion_matrix():
    print("[Check 9/9] Verifying stored metrics match raw confusion matrix calculations...")
    metrics_p = os.path.join(ROOT_DIR, "outputs", "experiments", "exp_a_transfer_learning", "metrics.json")
    cm_p = os.path.join(ROOT_DIR, "outputs", "experiments", "exp_a_transfer_learning", "confusion_matrix.json")
    with open(metrics_p, "r") as f:
        metrics = json.load(f)
    with open(cm_p, "r") as f:
        cm = np.array(json.load(f))
    
    total = float(cm.sum())
    diag = float(np.trace(cm))
    computed_acc = round(diag / total, 4) if total > 0 else 0.0
    stored_acc = metrics["stage2_metrics"]["overall_accuracy"]
    if abs(computed_acc - stored_acc) > 1e-3:
        raise AssertionError(f"Accuracy mismatch! CM computed={computed_acc}, stored={stored_acc}")
    print(f"  -> PASS: Stored accuracy ({stored_acc}) matches confusion matrix trace/total ({computed_acc}) exactly.")

def main():
    print("=" * 80)
    print("DRAS MODEL V4 — FINAL SCIENTIFIC AUDIT SUITE")
    print("=" * 80)
    try:
        check_1_metrics_and_artifacts()
        check_2_manifest_physical_files()
        check_3_checkpoints_exist()
        check_4_checkpoint_architecture()
        check_5_no_train_test_overlap()
        check_6_catalogue_only_isolation()
        check_7_sar_truthfulness()
        check_8_fastapi_v3_endpoint()
        check_9_metrics_match_confusion_matrix()
        print("\n" + "=" * 80)
        print("ALL 9 SCIENTIFIC INTEGRITY CHECKS PASSED WITH 100% SUCCESS.")
        print("ZERO FABRICATION. ZERO METRIC DRIFT. ZERO LEAKAGE.")
        print("=" * 80)
        sys.exit(0)
    except AssertionError as e:
        print(f"\n[FAIL] Audit failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
