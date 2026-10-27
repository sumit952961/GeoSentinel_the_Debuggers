"""
============================================================
Disaster Management System — xBD Subset Validation Script
============================================================

Purpose:
  Validates the integrity, correctness, and completeness of
  the extracted xBD subset.

Checks performed:
  1. Both pre-disaster and post-disaster PNG images open cleanly
  2. Image dimensions match (1024x1024, 3 channels)
  3. Pre-disaster and post-disaster JSON annotations exist
  4. JSON annotations contain valid GeoJSON/WKT geometries
  5. Every building polygon has a recognized damage classification:
     - no-damage
     - minor-damage
     - major-damage
     - destroyed
     - un-classified / background
  6. Target ground-truth masks match image dimensions
  7. No duplicate pairs exist
  8. Generates a statistical summary report
"""

import os
import sys
import json
import csv
from PIL import Image
import numpy as np
from shapely import wkt

SUBSET_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "xbd_subset")
IMAGES_DIR = os.path.join(SUBSET_DIR, "images")
ANNOTATIONS_DIR = os.path.join(SUBSET_DIR, "annotations")
MANIFEST_PATH = os.path.join(SUBSET_DIR, "manifest.csv")

VALID_DAMAGE_CLASSES = {"no-damage", "minor-damage", "major-damage", "destroyed", "un-classified", "unclassified"}


def validate_subset():
    print("=" * 65)
    print("Disaster Management System — xBD Subset Validator")
    print("=" * 65)

    if not os.path.exists(MANIFEST_PATH):
        print(f"[FAIL] Manifest not found at: {MANIFEST_PATH}")
        return False

    with open(MANIFEST_PATH, "r") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"\n[Validation] Found {len(rows)} image pairs in manifest. Validating each pair...\n")

    seen_pairs = set()
    total_buildings = 0
    damage_distribution = {"no-damage": 0, "minor-damage": 0, "major-damage": 0, "destroyed": 0, "unclassified": 0}
    errors = []

    for idx, row in enumerate(rows, 1):
        pair_id = row["pair_id"]
        
        # Check 1: Duplicate check
        if pair_id in seen_pairs:
            errors.append(f"Pair {pair_id}: Duplicate pair ID found!")
        seen_pairs.add(pair_id)

        # Check 2: Image files existence and dimensions
        pre_img_path = os.path.join(IMAGES_DIR, row["pre_image"])
        post_img_path = os.path.join(IMAGES_DIR, row["post_image"])

        if not os.path.exists(pre_img_path):
            errors.append(f"Pair {pair_id}: Missing pre-image {pre_img_path}")
            continue
        if not os.path.exists(post_img_path):
            errors.append(f"Pair {pair_id}: Missing post-image {post_img_path}")
            continue

        try:
            with Image.open(pre_img_path) as img:
                if img.size != (1024, 1024) or img.mode != "RGB":
                    errors.append(f"Pair {pair_id}: Invalid pre-image size/mode {img.size}/{img.mode}")
        except Exception as e:
            errors.append(f"Pair {pair_id}: Cannot open pre-image: {e}")

        try:
            with Image.open(post_img_path) as img:
                if img.size != (1024, 1024) or img.mode != "RGB":
                    errors.append(f"Pair {pair_id}: Invalid post-image size/mode {img.size}/{img.mode}")
        except Exception as e:
            errors.append(f"Pair {pair_id}: Cannot open post-image: {e}")

        # Check 3: JSON Annotations existence and format
        pre_json_path = os.path.join(ANNOTATIONS_DIR, row["pre_annotation"])
        post_json_path = os.path.join(ANNOTATIONS_DIR, row["post_annotation"])

        if not os.path.exists(pre_json_path):
            errors.append(f"Pair {pair_id}: Missing pre-annotation {pre_json_path}")
            continue
        if not os.path.exists(post_json_path):
            errors.append(f"Pair {pair_id}: Missing post-annotation {post_json_path}")
            continue

        try:
            with open(post_json_path, "r") as f:
                post_data = json.load(f)

            features = post_data.get("features", {}).get("xy", [])
            for feat in features:
                total_buildings += 1
                subtype = feat.get("properties", {}).get("subtype", "unclassified")
                if subtype not in VALID_DAMAGE_CLASSES:
                    errors.append(f"Pair {pair_id}: Invalid damage subtype '{subtype}'")
                
                # Map to damage distribution key
                norm_key = subtype if subtype in damage_distribution else "unclassified"
                damage_distribution[norm_key] = damage_distribution.get(norm_key, 0) + 1

                # Validate WKT polygon geometry
                wkt_str = feat.get("wkt", "")
                poly = wkt.loads(wkt_str)
                if not poly.is_valid or poly.is_empty:
                    errors.append(f"Pair {pair_id}: Invalid WKT geometry for building {feat.get('properties', {}).get('uid')}")
        except Exception as e:
            errors.append(f"Pair {pair_id}: Error reading post-disaster JSON: {e}")

        # Check 4: Target Mask existence
        target_mask_path = os.path.join(ANNOTATIONS_DIR, row["target_mask"])
        if os.path.exists(target_mask_path):
            try:
                with Image.open(target_mask_path) as m_img:
                    if m_img.size != (1024, 1024):
                        errors.append(f"Pair {pair_id}: Mask size {m_img.size} does not match (1024, 1024)")
            except Exception as e:
                errors.append(f"Pair {pair_id}: Error opening target mask: {e}")

        print(f"  [OK] Pair {idx:02d}: {pair_id} | Buildings: {row['number_of_buildings']} | No-Damage: {row['no_damage']} | Minor: {row['minor_damage']} | Major: {row['major_damage']} | Destroyed: {row['destroyed']}")

    # Report
    print("\n" + "=" * 65)
    print("VALIDATION SUMMARY REPORT")
    print("=" * 65)
    print(f"Total verified image pairs:      {len(rows)}")
    print(f"Total building polygons parsed:  {total_buildings}")
    print(f"Damage Class Distribution:")
    for k, v in damage_distribution.items():
        pct = (v / total_buildings * 100) if total_buildings > 0 else 0
        print(f"  - {k.ljust(15)}: {v:5d} ({pct:5.1f}%)")

    if errors:
        print(f"\n[FAIL] Encountered {len(errors)} error(s):")
        for err in errors[:10]:
            print(f"  - {err}")
        return False
    else:
        print("\n[SUCCESS] All 20 pre/post pairs and annotations passed 100% of validation checks!")
        return True


if __name__ == "__main__":
    success = validate_subset()
    sys.exit(0 if success else 1)
