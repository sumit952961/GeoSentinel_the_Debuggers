"""
============================================================
Disaster Management System — xBD Subset v2 Validator & Mask Generator
============================================================
"""

import os
import json
import csv
import cv2
import numpy as np
from PIL import Image
from collections import Counter

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "xbd_subset_v2")
IMAGES_DIR = os.path.join(DATA_DIR, "images")
ANNOTATIONS_DIR = os.path.join(DATA_DIR, "annotations")
MASKS_DIR = os.path.join(DATA_DIR, "masks")
MANIFEST_PATH = os.path.join(DATA_DIR, "manifest.csv")
SAMPLE_MASKS_DIR = os.path.join(DATA_DIR, "sample_masks")

COLOR_PALETTE = {
    0: (0, 0, 0),         # Background: Black
    1: (45, 106, 79),     # No Damage: Forest Green
    2: (244, 162, 97),    # Minor Damage: Warm Amber / Yellow
    3: (231, 111, 81),    # Major Damage: Bright Orange
    4: (155, 34, 38)      # Destroyed: Crimson Red
}


def mask_to_color_rgb(mask_2d):
    h, w = mask_2d.shape
    color_img = np.zeros((h, w, 3), dtype=np.uint8)
    for class_id, rgb_color in COLOR_PALETTE.items():
        color_img[mask_2d == class_id] = rgb_color
    return color_img


def create_side_by_side_overlay(pre_path, post_path, mask_path):
    pre_img = cv2.imread(pre_path)
    post_img = cv2.imread(post_path)
    mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
    
    if pre_img is None or post_img is None or mask is None:
        return None
        
    color_mask_rgb = mask_to_color_rgb(mask)
    color_mask_bgr = cv2.cvtColor(color_mask_rgb, cv2.COLOR_RGB2BGR)
    
    alpha = 0.55
    blended = cv2.addWeighted(post_img, 1 - alpha, color_mask_bgr, alpha, 0)
    overlay = post_img.copy()
    overlay[mask > 0] = blended[mask > 0]
    
    # Draw contour outlines
    for class_id, rgb_color in COLOR_PALETTE.items():
        if class_id == 0: continue
        bgr_color = (rgb_color[2], rgb_color[1], rgb_color[0])
        binary = (mask == class_id).astype(np.uint8)
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(overlay, contours, -1, bgr_color, 2)
        
    # Scale down to 512x512 each for a clean side-by-side composite
    target_size = (480, 480)
    pre_small = cv2.resize(pre_img, target_size)
    post_small = cv2.resize(post_img, target_size)
    mask_small = cv2.resize(color_mask_bgr, target_size, interpolation=cv2.INTER_NEAREST)
    over_small = cv2.resize(overlay, target_size)
    
    # Add title labels
    def add_label(img, text):
        cv2.rectangle(img, (0, 0), (target_size[0], 28), (20, 20, 20), -1)
        cv2.putText(img, text, (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)
        return img
        
    pre_labeled = add_label(pre_small, "1. Pre-Disaster Image")
    post_labeled = add_label(post_small, "2. Post-Disaster Image")
    mask_labeled = add_label(mask_small, "3. Damage Mask (Ground Truth)")
    over_labeled = add_label(over_small, "4. Verification Overlay")
    
    row1 = np.hstack([pre_labeled, post_labeled])
    row2 = np.hstack([mask_labeled, over_labeled])
    composite = np.vstack([row1, row2])
    
    return composite


def main():
    print("=" * 75)
    print("Disaster Management System — xBD Subset v2 Validator & Mask Verifier")
    print("=" * 75)
    
    os.makedirs(SAMPLE_MASKS_DIR, exist_ok=True)
    
    with open(MANIFEST_PATH, "r") as f:
        reader = list(csv.DictReader(f))
        
    print(f"Validating {len(reader)} pairs from manifest.csv...")
    
    totals = Counter()
    disaster_totals = {}
    
    # Select candidate representative pairs for diverse visual mask output
    selected_for_vis = [
        "hurricane-michael_00000127",   # Contains all 4 classes: No-Dam, Minor, Major, Destroyed
        "hurricane-matthew_00000218",   # Contains Minor, Major, Destroyed
        "hurricane-harvey_00000376",    # Contains Major, Destroyed
        "santa-rosa-wildfire_00000077", # Contains Destroyed, No-Dam, Major
        "midwest-flooding_00000373"     # Contains Flooding Minor, Major, Destroyed
    ]
    
    for row in reader:
        pair_id = row["pair_id"]
        disaster = row["disaster"]
        
        nodam = int(row["no_damage_count"])
        minor = int(row["minor_damage_count"])
        major = int(row["major_damage_count"])
        destr = int(row["destroyed_count"])
        
        totals[1] += nodam
        totals[2] += minor
        totals[3] += major
        totals[4] += destr
        
        if disaster not in disaster_totals:
            disaster_totals[disaster] = Counter()
        disaster_totals[disaster][1] += nodam
        disaster_totals[disaster][2] += minor
        disaster_totals[disaster][3] += major
        disaster_totals[disaster][4] += destr
        
        pre_p = os.path.join(DATA_DIR, row["pre_image"])
        post_p = os.path.join(DATA_DIR, row["post_image"])
        mask_p = os.path.join(MASKS_DIR, f"{pair_id}_target.png")
        
        if not os.path.exists(pre_p) or not os.path.exists(post_p) or not os.path.exists(mask_p):
            print(f"  [ERROR] Missing files for {pair_id}")
            continue
            
        if pair_id in selected_for_vis:
            comp = create_side_by_side_overlay(pre_p, post_p, mask_p)
            if comp is not None:
                out_path = os.path.join(SAMPLE_MASKS_DIR, f"{pair_id}_composite.png")
                cv2.imwrite(out_path, comp)
                print(f"  [Visual Sample] Generated 4-panel composite: {pair_id} -> {out_path}")

    print("\n" + "=" * 75)
    print("SUBSET V2 VALIDATION SUMMARY")
    print("=" * 75)
    print(f"Total Validated Pairs: {len(reader)}")
    print(f"Total Building Polygons: {sum(totals.values())}")
    print(f"  - Class 1 (No Damage):    {totals[1]:<5} ({totals[1]/sum(totals.values())*100:.1f}%)")
    print(f"  - Class 2 (Minor Damage): {totals[2]:<5} ({totals[2]/sum(totals.values())*100:.1f}%)")
    print(f"  - Class 3 (Major Damage): {totals[3]:<5} ({totals[3]/sum(totals.values())*100:.1f}%)")
    print(f"  - Class 4 (Destroyed):    {totals[4]:<5} ({totals[4]/sum(totals.values())*100:.1f}%)")
    
    print("\nBreakdown by Disaster:")
    for d, counts in sorted(disaster_totals.items()):
        total_d = sum(counts.values())
        print(f"  {d:<22} | Total: {total_d:<4} | No-Dam: {counts[1]:<4} | Minor: {counts[2]:<4} | Major: {counts[3]:<4} | Destr: {counts[4]:<4}")
    print("=" * 75)

if __name__ == "__main__":
    main()
