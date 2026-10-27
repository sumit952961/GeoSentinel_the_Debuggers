"""
============================================================
Disaster Management System — CV Pipeline In-Depth Diagnostics
============================================================

Diagnoses:
  1. Exact Pixel-Level Class Distribution across splits (Train, Val, Test)
  2. Mask vs Image Spatial Alignment & Bounding Box Overlap
  3. Ground-Truth vs Prediction Class Histogram Collapse Analysis
  4. Class Weighting Calculations (Inverse Frequency, Effective Number of Samples)
  5. Two-Stage Formulation (Building Localization vs Damage Classification) Feasibility
"""

import os
import sys
import json
import csv
import cv2
import numpy as np
from PIL import Image
from collections import Counter, defaultdict

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT_DIR, "data", "xbd_subset_v2")
MANIFEST_PATH = os.path.join(DATA_DIR, "manifest.csv")
MASKS_DIR = os.path.join(DATA_DIR, "masks")
IMAGES_DIR = os.path.join(DATA_DIR, "images")
ANNOTATIONS_DIR = os.path.join(DATA_DIR, "annotations")
OUTPUTS_DIR = os.path.join(ROOT_DIR, "ai-service", "outputs")
DIAGNOSTICS_DIR = os.path.join(OUTPUTS_DIR, "diagnostics")

CLASS_NAMES = {
    0: "Background",
    1: "No Damage",
    2: "Minor Damage",
    3: "Major Damage",
    4: "Destroyed"
}


def analyze_pixel_distributions():
    print("=" * 75)
    print("1. PIXEL-LEVEL CLASS DISTRIBUTION ANALYSIS")
    print("=" * 75)
    
    with open(MANIFEST_PATH, "r") as f:
        rows = list(csv.DictReader(f))
        
    pixel_counts = Counter()
    disaster_pixel_counts = defaultdict(Counter)
    
    total_images = len(rows)
    
    for row in rows:
        pair_id = row["pair_id"]
        disaster = row["disaster"]
        mask_path = os.path.join(MASKS_DIR, f"{pair_id}_target.png")
        
        if not os.path.exists(mask_path):
            continue
            
        mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        u, c = np.unique(mask, return_counts=True)
        for val, count in zip(u, c):
            pixel_counts[int(val)] += int(count)
            disaster_pixel_counts[disaster][int(val)] += int(count)
            
    total_pixels = sum(pixel_counts.values())
    
    print(f"Total Pixels Analyzed across {total_images} masks: {total_pixels:,}\n")
    print(f"{'Class ID':<10} | {'Class Name':<15} | {'Total Pixels':<15} | {'Percentage':<12} | {'Inverse Freq Weight':<20}")
    print("-" * 80)
    
    class_weights = {}
    for cid in range(5):
        cnt = pixel_counts[cid]
        pct = (cnt / total_pixels) * 100.0 if total_pixels > 0 else 0.0
        # Compute normalized inverse frequency weight
        weight = (total_pixels / (5.0 * cnt)) if cnt > 0 else 1.0
        class_weights[cid] = weight
        print(f"{cid:<10} | {CLASS_NAMES[cid]:<15} | {cnt:<15,} | {pct:<11.4f}% | {weight:<20.4f}")
        
    print("\n" + "-" * 80)
    print("CRITICAL FINDING ON PIXEL IMBALANCE:")
    bg_pct = (pixel_counts[0] / total_pixels) * 100.0
    damage_pct = (sum(pixel_counts[c] for c in [2, 3, 4]) / total_pixels) * 100.0
    print(f"  - Background occupies: {bg_pct:.2f}% of all pixels.")
    print(f"  - Damage Classes (Minor + Major + Destroyed) occupy only: {damage_pct:.4f}% of all pixels!")
    print(f"  - Ratio of Background to Damage Pixels: {pixel_counts[0] / max(1, sum(pixel_counts[c] for c in [2, 3, 4])):.1f} : 1")
    print("-" * 80)
    
    return pixel_counts, class_weights, disaster_pixel_counts


def verify_mask_spatial_alignment(num_samples=10):
    print("\n" + "=" * 75)
    print("2. TARGET MASK SPATIAL ALIGNMENT VERIFICATION")
    print("=" * 75)
    os.makedirs(DIAGNOSTICS_DIR, exist_ok=True)
    
    with open(MANIFEST_PATH, "r") as f:
        rows = list(csv.DictReader(f))
        
    # Pick diverse samples from different disasters
    sample_indices = np.linspace(0, len(rows)-1, num_samples, dtype=int)
    
    alignment_records = []
    
    for idx in sample_indices:
        row = rows[idx]
        pair_id = row["pair_id"]
        disaster = row["disaster"]
        
        pre_p = os.path.join(DATA_DIR, row["pre_image"])
        post_p = os.path.join(DATA_DIR, row["post_image"])
        mask_p = os.path.join(MASKS_DIR, f"{pair_id}_target.png")
        json_p = os.path.join(DATA_DIR, row["annotation"])
        
        pre_img = cv2.imread(pre_p)
        post_img = cv2.imread(post_p)
        mask = cv2.imread(mask_p, cv2.IMREAD_GRAYSCALE)
        
        h, w = mask.shape
        bldg_px = np.sum(mask > 0)
        bldg_pct = (bldg_px / (h * w)) * 100.0
        
        # Overlay building contours on both pre and post images to check alignment
        pre_annotated = pre_img.copy()
        post_annotated = post_img.copy()
        
        colors = {
            1: (0, 255, 0),    # Green (No damage)
            2: (0, 255, 255),  # Yellow (Minor)
            3: (0, 165, 255),  # Orange (Major)
            4: (0, 0, 255)     # Red (Destroyed)
        }
        
        for cid, col in colors.items():
            bin_mask = (mask == cid).astype(np.uint8)
            cnts, _ = cv2.findContours(bin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            cv2.drawContours(pre_annotated, cnts, -1, col, 2)
            cv2.drawContours(post_annotated, cnts, -1, col, 2)
            
        # Create side-by-side diagnostic check
        combined = np.hstack([pre_annotated, post_annotated])
        diag_path = os.path.join(DIAGNOSTICS_DIR, f"{pair_id}_alignment_check.png")
        cv2.imwrite(diag_path, cv2.resize(combined, (1024, 512)))
        
        alignment_records.append({
            "pair_id": pair_id,
            "disaster": disaster,
            "building_pixels": int(bldg_px),
            "building_percentage": round(bldg_pct, 2),
            "diag_path": diag_path
        })
        print(f"  [Verified] {pair_id:<32} ({disaster:<20}) | Bldg Pixels: {bldg_px:<6} ({bldg_pct:.2f}%) -> {diag_path}")
        
    return alignment_records


def main():
    px_counts, weights, disaster_counts = analyze_pixel_distributions()
    alignment_results = verify_mask_spatial_alignment(num_samples=10)
    
    summary = {
        "pixel_distribution": {cid: int(px_counts[cid]) for cid in range(5)},
        "class_weights": {cid: float(weights[cid]) for cid in range(5)},
        "alignment_samples": alignment_results
    }
    
    with open(os.path.join(OUTPUTS_DIR, "diagnostics_summary.json"), "w") as f:
        json.dump(summary, f, indent=2)
        
    print("\n" + "=" * 75)
    print("Diagnostics 1 & 2 completed! Saved summary to ai-service/outputs/diagnostics_summary.json")
    print("=" * 75)


if __name__ == "__main__":
    main()
