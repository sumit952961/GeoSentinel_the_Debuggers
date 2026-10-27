"""
============================================================
Disaster Management System — Sample Mask Generator & Visualizer
============================================================

Purpose:
  Demonstrates and validates the annotation conversion pipeline:
    xBD JSON
    → WKT Building Polygons
    → Damage Class Label
    → 2D Raster Segmentation Mask (values 0..4)
    → RGB Color-Coded Overlay Image

Damage Class Color Palette:
  0: Background   -> [0, 0, 0]       (Black / Transparent)
  1: No Damage    -> [45, 106, 79]   (Green)
  2: Minor Damage -> [244, 162, 97]  (Yellow/Amber)
  3: Major Damage -> [231, 111, 81]  (Orange)
  4: Destroyed    -> [155, 34, 38]   (Crimson Red)

Outputs:
  data/xbd_subset/sample_masks/
    ├── <id>_mask_color.png      (Color-coded 5-class mask)
    ├── <id>_overlay.png         (Pre/Post side-by-side with damage overlay)
    └── ...
"""

import os
import sys
import json
import numpy as np
import cv2
from PIL import Image
from shapely import wkt

SUBSET_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "xbd_subset")
IMAGES_DIR = os.path.join(SUBSET_DIR, "images")
ANNOTATIONS_DIR = os.path.join(SUBSET_DIR, "annotations")
OUTPUT_DIR = os.path.join(SUBSET_DIR, "sample_masks")

# RGB Color Mapping for the 5 classes
COLOR_PALETTE = {
    0: (0, 0, 0),        # Background
    1: (45, 106, 79),    # No Damage (Green)
    2: (244, 162, 97),   # Minor Damage (Amber/Yellow)
    3: (231, 111, 81),   # Major Damage (Orange)
    4: (155, 34, 38)     # Destroyed (Red)
}

DAMAGE_SUBTYPE_TO_ID = {
    "no-damage": 1,
    "minor-damage": 2,
    "major-damage": 3,
    "destroyed": 4,
    "un-classified": 1,
    "unclassified": 1
}


def create_segmentation_mask_from_json(json_path, image_shape=(1024, 1024)):
    """
    Parses xBD post-disaster JSON file and rasterizes building polygons
    into an integer numpy array where pixel values are in {0, 1, 2, 3, 4}.
    """
    with open(json_path, "r") as f:
        data = json.load(f)

    mask = np.zeros(image_shape, dtype=np.uint8)
    features = data.get("features", {}).get("xy", [])

    for feat in features:
        wkt_str = feat.get("wkt", "")
        subtype = feat.get("properties", {}).get("subtype", "no-damage")
        class_id = DAMAGE_SUBTYPE_TO_ID.get(subtype, 1)

        try:
            poly = wkt.loads(wkt_str)
            if not poly.is_valid or poly.is_empty:
                continue

            # Extract exterior coordinates
            coords = np.array(poly.exterior.coords, dtype=np.int32)
            # Rasterize polygon with the class ID
            cv2.fillPoly(mask, [coords], color=class_id)
        except Exception:
            continue

    return mask


def colorize_mask(mask):
    """Converts 2D integer mask (0..4) to RGB image."""
    h, w = mask.shape
    color_img = np.zeros((h, w, 3), dtype=np.uint8)
    for class_id, color in COLOR_PALETTE.items():
        color_img[mask == class_id] = color
    return color_img


def create_side_by_side_overlay(pre_img_path, post_img_path, mask):
    """Creates a side-by-side composite: Pre-Image | Post-Image with Damage Overlay."""
    pre_img = cv2.imread(pre_img_path)
    post_img = cv2.imread(post_img_path)

    if pre_img is None or post_img is None:
        return None

    # Colorize mask
    color_mask = colorize_mask(mask)
    # Convert RGB color mask to BGR for OpenCV
    color_mask_bgr = cv2.cvtColor(color_mask, cv2.COLOR_RGB2BGR)

    # Blend damage mask onto post-image
    alpha = 0.55
    blended = cv2.addWeighted(post_img, 1 - alpha, color_mask_bgr, alpha, 0)
    
    overlay = post_img.copy()
    building_pixels = mask > 0
    overlay[building_pixels] = blended[building_pixels]

    # Draw building contour outlines
    for class_id, color in COLOR_PALETTE.items():
        if class_id == 0:
            continue
        b_mask = (mask == class_id).astype(np.uint8)
        cnts, _ = cv2.findContours(b_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        color_bgr = (color[2], color[1], color[0])
        cv2.drawContours(overlay, cnts, -1, color_bgr, 2)

    # Combine: Pre-Disaster (Left) and Post-Disaster Overlay (Right)
    # Resize to 512x512 each for compact side-by-side preview
    pre_small = cv2.resize(pre_img, (512, 512))
    post_small = cv2.resize(overlay, (512, 512))

    # Add text labels
    cv2.putText(pre_small, "PRE-DISASTER", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(post_small, "POST-DISASTER (DAMAGE OVERLAY)", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)

    composite = np.hstack([pre_small, post_small])
    return composite


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("=" * 65)
    print("Generating Sample Damage Segmentation Masks...")
    print("=" * 65)

    if not os.path.exists(ANNOTATIONS_DIR):
        print(f"[Error] Annotations directory not found: {ANNOTATIONS_DIR}")
        return

    json_files = [f for f in os.listdir(ANNOTATIONS_DIR) if f.endswith("_post_disaster.json")]
    if not json_files:
        print("[Error] No post-disaster JSON files found. Run prepare_xbd_subset.py first.")
        return

    sample_files = json_files[:5]  # Generate top 5 samples
    for j_file in sample_files:
        pair_id = j_file.replace("_post_disaster.json", "")
        post_json_path = os.path.join(ANNOTATIONS_DIR, j_file)
        pre_img_path = os.path.join(IMAGES_DIR, f"{pair_id}_pre_disaster.png")
        post_img_path = os.path.join(IMAGES_DIR, f"{pair_id}_post_disaster.png")

        # 1. Rasterize JSON to integer mask
        mask = create_segmentation_mask_from_json(post_json_path)

        # 2. Save color mask
        color_mask = colorize_mask(mask)
        color_mask_path = os.path.join(OUTPUT_DIR, f"{pair_id}_mask_color.png")
        Image.fromarray(color_mask).save(color_mask_path)

        # 3. Save side-by-side comparison overlay
        if os.path.exists(pre_img_path) and os.path.exists(post_img_path):
            composite = create_side_by_side_overlay(pre_img_path, post_img_path, mask)
            if composite is not None:
                composite_path = os.path.join(OUTPUT_DIR, f"{pair_id}_overlay.png")
                cv2.imwrite(composite_path, composite)

        unique_classes = np.unique(mask)
        print(f"  [Sample Generated] {pair_id} | Unique classes: {unique_classes} | Saved to: {color_mask_path}")

    print("\n[SUCCESS] Sample masks and overlay comparisons generated in:", OUTPUT_DIR)


if __name__ == "__main__":
    main()
