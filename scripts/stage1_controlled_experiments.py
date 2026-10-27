"""
============================================================
Stage 1 Controlled Improvement Study (3 Controlled Experiments)
============================================================
Rules:
  - Validation set is used strictly for parameter selection / tuning.
  - Selected configurations are evaluated ONCE on the held-out test set.
  - Compares against baseline: IoU = 43.08%, Dice/F1 = 60.22%.
"""

import os
import sys
import time
import json
import numpy as np
import torch
import cv2
from cv2 import morphologyEx, getStructuringElement, MORPH_CLOSE, MORPH_RECT
from torch.utils.data import DataLoader

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AI_DIR = os.path.join(ROOT_DIR, "ai-service")
sys.path.append(AI_DIR)

from app.cv.stage1_localization import (
    create_disaster_aware_split,
    XBDDataset,
    BinaryBuildingDataset,
    BuildingLocalizationUNet,
    calculate_binary_metrics,
    MANIFEST_CSV,
    DATA_DIR
)

MODEL_PATH = os.path.join(AI_DIR, "models", "stage1_building_loc_best.pth")
if not os.path.exists(MODEL_PATH):
    MODEL_PATH = os.path.join(AI_DIR, "models", "unet_resnet34_pre_post.pth")

def evaluate_loader(model, loader, threshold=0.50, post_process_fn=None, use_tta=False):
    model.eval()
    all_preds = []
    all_targets = []
    latencies = []

    with torch.no_grad():
        for batch in loader:
            imgs = batch["image"]
            masks = batch["mask"]

            t0 = time.perf_counter()
            if use_tta:
                # 4-fold flip TTA
                x_h = torch.flip(imgs, dims=[3])
                x_v = torch.flip(imgs, dims=[2])
                x_hv = torch.flip(imgs, dims=[2, 3])

                out = torch.sigmoid(model(imgs))
                out_h = torch.flip(torch.sigmoid(model(x_h)), dims=[3])
                out_v = torch.flip(torch.sigmoid(model(x_v)), dims=[2])
                out_hv = torch.flip(torch.sigmoid(model(x_hv)), dims=[2, 3])

                probs = ((out + out_h + out_v + out_hv) / 4.0).squeeze(1).cpu().numpy()
            else:
                logits = model(imgs)
                probs = torch.sigmoid(logits).squeeze(1).cpu().numpy()

            t_infer = ((time.perf_counter() - t0) * 1000.0) / len(imgs)
            latencies.extend([t_infer] * len(imgs))

            pred_bin = (probs >= threshold).astype(np.uint8)

            if post_process_fn is not None:
                for b_idx in range(len(pred_bin)):
                    pred_bin[b_idx] = post_process_fn(pred_bin[b_idx])

            all_preds.append(pred_bin)
            all_targets.append(masks.squeeze(1).cpu().numpy())

    preds_np = np.concatenate(all_preds, axis=0).flatten()
    targets_np = np.concatenate(all_targets, axis=0).flatten()

    metrics = calculate_binary_metrics(targets_np, preds_np, threshold=threshold)
    metrics["mean_latency_ms"] = float(np.mean(latencies))
    metrics["std_latency_ms"] = float(np.std(latencies))
    return metrics

def run_study():
    print("=" * 80)
    print("STAGE 1 CONTROLLED IMPROVEMENT STUDY")
    print("Comparing against Baseline: IoU = 43.08%, Dice/F1 = 60.22%")
    print("=" * 80)

    # 1. Dataset splits
    train_pairs, val_pairs, test_pairs = create_disaster_aware_split(MANIFEST_CSV)
    print(f"Validation Pairs: {len(val_pairs)} | Test Pairs: {len(test_pairs)}")

    val_base = XBDDataset(val_pairs, DATA_DIR, mode="pre_post", target_size=(512, 512), is_training=False)
    test_base = XBDDataset(test_pairs, DATA_DIR, mode="pre_post", target_size=(512, 512), is_training=False)

    val_loader = DataLoader(BinaryBuildingDataset(val_base), batch_size=4, shuffle=False)
    test_loader = DataLoader(BinaryBuildingDataset(test_base), batch_size=4, shuffle=False)

    # 2. Load Stage 1 Best Model
    model = BuildingLocalizationUNet(in_channels=6)
    state = torch.load(MODEL_PATH, map_location="cpu")
    if "model_state_dict" in state:
        model.load_state_dict(state["model_state_dict"])
    else:
        model.load_state_dict(state)
    model.eval()

    # -------------------------------------------------------------
    # BASELINE VERIFICATION ON TEST SET (tau = 0.50, raw mask, no TTA)
    # -------------------------------------------------------------
    baseline_test = evaluate_loader(model, test_loader, threshold=0.50)
    print(f"\n[Verified Test Baseline (tau=0.50)]")
    print(f"  IoU:       {baseline_test['iou']*100:.2f}%")
    print(f"  Dice/F1:   {baseline_test['f1']*100:.2f}%")
    print(f"  Precision: {baseline_test['precision']*100:.2f}%")
    print(f"  Recall:    {baseline_test['recall']*100:.2f}%")
    print(f"  Accuracy:  {baseline_test['pixel_accuracy']*100:.2f}%")
    print(f"  Latency:   {baseline_test['mean_latency_ms']:.1f} ms / crop")

    # -------------------------------------------------------------
    # EXPERIMENT 1: Validation-Guided Threshold Tuning (tau*)
    # -------------------------------------------------------------
    print("\n" + "-" * 60)
    print("EXPERIMENT 1: Optimal Decision Threshold Sweep on Validation Set")
    print("-" * 60)

    best_val_tau = 0.50
    best_val_iou = -1.0

    for tau in [0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70]:
        val_m = evaluate_loader(model, val_loader, threshold=tau)
        print(f"  Val tau={tau:.2f} -> IoU: {val_m['iou']*100:.2f}%, F1: {val_m['f1']*100:.2f}%, Prec: {val_m['precision']*100:.2f}%, Rec: {val_m['recall']*100:.2f}%")
        if val_m["iou"] > best_val_iou:
            best_val_iou = val_m["iou"]
            best_val_tau = tau

    print(f"  --> Optimal Validation Threshold: tau* = {best_val_tau:.2f} (Val IoU: {best_val_iou*100:.2f}%)")

    # Evaluate selected threshold once on Test Set
    exp1_test = evaluate_loader(model, test_loader, threshold=best_val_tau)
    print(f"  [Experiment 1 Test Result (tau*={best_val_tau:.2f})]")
    print(f"    IoU:       {exp1_test['iou']*100:.2f}% (Delta: {(exp1_test['iou'] - baseline_test['iou'])*100:+.2f}%)")
    print(f"    Dice/F1:   {exp1_test['f1']*100:.2f}% (Delta: {(exp1_test['f1'] - baseline_test['f1'])*100:+.2f}%)")
    print(f"    Precision: {exp1_test['precision']*100:.2f}%")
    print(f"    Recall:    {exp1_test['recall']*100:.2f}%")
    print(f"    Latency:   {exp1_test['mean_latency_ms']:.1f} ms")

    # -------------------------------------------------------------
    # EXPERIMENT 2: Morphological Post-Processing & Filtering
    # -------------------------------------------------------------
    print("\n" + "-" * 60)
    print("EXPERIMENT 2: Morphological Post-Processing on Validation Set")
    print("-" * 60)

    def filter_small_blobs(mask, min_size=20):
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(mask)
        out = np.zeros_like(mask)
        for lbl in range(1, num_labels):
            if stats[lbl, cv2.CC_STAT_AREA] >= min_size:
                out[labels == lbl] = 1
        return out

    def morph_close_filter(mask):
        kernel = getStructuringElement(MORPH_RECT, (3, 3))
        closed = morphologyEx(mask, MORPH_CLOSE, kernel)
        return filter_small_blobs(closed, min_size=15)

    val_raw = evaluate_loader(model, val_loader, threshold=best_val_tau)
    val_blob = evaluate_loader(model, val_loader, threshold=best_val_tau, post_process_fn=lambda m: filter_small_blobs(m, 20))
    val_morph = evaluate_loader(model, val_loader, threshold=best_val_tau, post_process_fn=morph_close_filter)

    print(f"  Val Raw (tau*):           IoU: {val_raw['iou']*100:.2f}%, F1: {val_raw['f1']*100:.2f}%")
    print(f"  Val + Area Filter (20px):  IoU: {val_blob['iou']*100:.2f}%, F1: {val_blob['f1']*100:.2f}%")
    print(f"  Val + Morph Close (3x3):   IoU: {val_morph['iou']*100:.2f}%, F1: {val_morph['f1']*100:.2f}%")

    best_post_fn = morph_close_filter if val_morph["iou"] >= val_blob["iou"] else lambda m: filter_small_blobs(m, 20)

    exp2_test = evaluate_loader(model, test_loader, threshold=best_val_tau, post_process_fn=best_post_fn)
    print(f"  [Experiment 2 Test Result (Morphological Post-Processing)]")
    print(f"    IoU:       {exp2_test['iou']*100:.2f}% (Delta: {(exp2_test['iou'] - baseline_test['iou'])*100:+.2f}%)")
    print(f"    Dice/F1:   {exp2_test['f1']*100:.2f}% (Delta: {(exp2_test['f1'] - baseline_test['f1'])*100:+.2f}%)")
    print(f"    Precision: {exp2_test['precision']*100:.2f}%")
    print(f"    Recall:    {exp2_test['recall']*100:.2f}%")
    print(f"    Latency:   {exp2_test['mean_latency_ms']:.1f} ms")

    # -------------------------------------------------------------
    # EXPERIMENT 3: Test-Time Augmentation (4-Fold Flip Averaging)
    # -------------------------------------------------------------
    print("\n" + "-" * 60)
    print("EXPERIMENT 3: Test-Time Augmentation (TTA - 4-Fold Flip Averaging)")
    print("-" * 60)

    val_tta = evaluate_loader(model, val_loader, threshold=best_val_tau, use_tta=True)
    print(f"  Val TTA: IoU: {val_tta['iou']*100:.2f}%, F1: {val_tta['f1']*100:.2f}%, Latency: {val_tta['mean_latency_ms']:.1f} ms")

    exp3_test = evaluate_loader(model, test_loader, threshold=best_val_tau, use_tta=True)
    print(f"  [Experiment 3 Test Result (4-Fold TTA)]")
    print(f"    IoU:       {exp3_test['iou']*100:.2f}% (Delta: {(exp3_test['iou'] - baseline_test['iou'])*100:+.2f}%)")
    print(f"    Dice/F1:   {exp3_test['f1']*100:.2f}% (Delta: {(exp3_test['f1'] - baseline_test['f1'])*100:+.2f}%)")
    print(f"    Precision: {exp3_test['precision']*100:.2f}%")
    print(f"    Recall:    {exp3_test['recall']*100:.2f}%")
    print(f"    Latency:   {exp3_test['mean_latency_ms']:.1f} ms (CPU Latency multiplier: {exp3_test['mean_latency_ms'] / baseline_test['mean_latency_ms']:.1f}x)")

    # -------------------------------------------------------------
    # SUMMARY COMPARISON TABLE
    # -------------------------------------------------------------
    print("\n" + "=" * 80)
    print("SUMMARY COMPARISON ACROSS CONTROLLED EXPERIMENTS")
    print("=" * 80)
    print(f"{'Configuration':<32} | {'IoU':<8} | {'Dice/F1':<8} | {'Precision':<10} | {'Recall':<8} | {'Latency':<10}")
    print("-" * 80)
    print(f"{'Baseline (tau=0.50, raw)':<32} | {baseline_test['iou']*100:.2f}%  | {baseline_test['f1']*100:.2f}%  | {baseline_test['precision']*100:.2f}%    | {baseline_test['recall']*100:.2f}%  | {baseline_test['mean_latency_ms']:.1f} ms")
    print(f"{'Exp 1: Val tau* tuning (' + str(best_val_tau) + ')':<32} | {exp1_test['iou']*100:.2f}%  | {exp1_test['f1']*100:.2f}%  | {exp1_test['precision']*100:.2f}%    | {exp1_test['recall']*100:.2f}%  | {exp1_test['mean_latency_ms']:.1f} ms")
    print(f"{'Exp 2: Morph Post-Processing':<32} | {exp2_test['iou']*100:.2f}%  | {exp2_test['f1']*100:.2f}%  | {exp2_test['precision']*100:.2f}%    | {exp2_test['recall']*100:.2f}%  | {exp2_test['mean_latency_ms']:.1f} ms")
    print(f"{'Exp 3: 4-Fold Flip TTA':<32} | {exp3_test['iou']*100:.2f}%  | {exp3_test['f1']*100:.2f}%  | {exp3_test['precision']*100:.2f}%    | {exp3_test['recall']*100:.2f}%  | {exp3_test['mean_latency_ms']:.1f} ms")
    print("=" * 80)

    # Save Results
    results_out = {
        "baseline": baseline_test,
        "exp1_threshold_tuning": {"tau_star": best_val_tau, "metrics": exp1_test},
        "exp2_morphological": exp2_test,
        "exp3_tta": exp3_test
    }
    with open(os.path.join(AI_DIR, "outputs", "stage1_controlled_experiments_study.json"), "w") as f:
        json.dump(results_out, f, indent=2)

if __name__ == "__main__":
    run_study()
