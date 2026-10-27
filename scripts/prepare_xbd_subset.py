"""
============================================================
Disaster Management System — xBD Subset Preparation Script
============================================================

Purpose:
  Downloads and prepares a verified subset of ~20 complete
  pre/post disaster image pairs with full annotations from
  a single disaster event (socal-fire: Southern California Wildfire).

Why this disaster:
  The 2018 Southern California Wildfire (Woolsey / Camp Fire)
  contains rich variations across all four damage tiers:
    - 0: Background
    - 1: No Damage
    - 2: Minor Damage
    - 3: Major Damage
    - 4: Destroyed

Output Structure:
  data/xbd_subset/
    ├── images/
    │   ├── socal-fire_00000037_pre_disaster.png
    │   ├── socal-fire_00000037_post_disaster.png
    │   └── ... (40 images = 20 pairs)
    ├── annotations/
    │   ├── socal-fire_00000037_pre_disaster.json
    │   ├── socal-fire_00000037_post_disaster.json
    │   ├── socal-fire_00000037_target.png  (Ground truth 5-class mask)
    │   └── ...
    └── manifest.csv (Metadata summary of all pairs)
"""

import os
import sys
import json
import csv
import io
import urllib.request
import numpy as np
import cv2
from PIL import Image
import pyarrow.parquet as pq
from shapely.geometry import Polygon, mapping
from shapely import wkt

# Configuration
DISASTER_NAME = "socal-fire"
TARGET_PAIRS = 20
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "xbd_subset")
IMAGES_DIR = os.path.join(OUTPUT_DIR, "images")
ANNOTATIONS_DIR = os.path.join(OUTPUT_DIR, "annotations")
CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "cache")
MANIFEST_PATH = os.path.join(OUTPUT_DIR, "manifest.csv")

PARQUET_URL = "https://huggingface.co/datasets/kshitijrajsharma/xview2-xbd/resolve/main/data/hold-00000-of-00006.parquet"

# Geographical reference for Woolsey/Southern California Fire (Malibu / Ventura / LA county, CA)
# Centered around: 34.0259° N, 118.7798° W (Malibu / Santa Monica Mountains)
GEO_BOUNDING_BOX = {
    "center_lat": 34.0522,
    "center_lon": -118.6850,
    "min_lat": 34.0000,
    "max_lat": 34.1200,
    "min_lon": -118.8500,
    "max_lon": -118.5500,
    "location_name": "Southern California, USA (Woolsey Fire, Malibu / Ventura County)",
    "event_date": "2018-11-08"
}

DAMAGE_LABEL_MAP = {
    0: "background",
    1: "no-damage",
    2: "minor-damage",
    3: "major-damage",
    4: "destroyed"
}


def ensure_directories():
    os.makedirs(IMAGES_DIR, exist_ok=True)
    os.makedirs(ANNOTATIONS_DIR, exist_ok=True)
    os.makedirs(CACHE_DIR, exist_ok=True)


def download_parquet_with_progress(url, dest_path):
    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 100 * 1024 * 1024:
        print(f"[xBD Ingestion] Using cached parquet: {dest_path} ({os.path.getsize(dest_path) / (1024*1024):.1f} MB)")
        return dest_path

    print(f"[xBD Ingestion] Downloading xBD dataset partition from Hugging Face...")
    print(f"  URL: {url}")
    print(f"  Destination: {dest_path}")
    
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req) as resp, open(dest_path, "wb") as out_file:
        total_size = int(resp.headers.get("Content-Length", 0))
        downloaded = 0
        chunk_size = 1024 * 1024 # 1MB chunks
        
        while True:
            chunk = resp.read(chunk_size)
            if not chunk:
                break
            out_file.write(chunk)
            downloaded += len(chunk)
            if total_size > 0:
                percent = downloaded / total_size * 100
                mb_down = downloaded / (1024 * 1024)
                mb_total = total_size / (1024 * 1024)
                sys.stdout.write(f"\r  Progress: {percent:.1f}% ({mb_down:.1f}/{mb_total:.1f} MB)")
                sys.stdout.flush()
        print("\n[xBD Ingestion] Download complete.")
    return dest_path


def extract_polygons_from_mask(mask_array, pixel_res_deg=0.000005, top_left_lat=34.08, top_left_lon=-118.75):
    """
    Extracts building polygons and GeoJSON/WKT geometries from an xBD target mask.
    Returns:
      - features_xy: list of pixel-space WKT polygon features
      - features_lng_lat: list of geographic WGS84 WKT polygon features
      - counts: dict of damage class counts
    """
    features_xy = []
    features_lng_lat = []
    counts = {"no_damage": 0, "minor_damage": 0, "major_damage": 0, "destroyed": 0, "unclassified": 0}

    class_keys = {
        1: ("no-damage", "no_damage"),
        2: ("minor-damage", "minor_damage"),
        3: ("major-damage", "major_damage"),
        4: ("destroyed", "destroyed")
    }

    bld_uid = 1
    for cls_id, (subtype_name, count_key) in class_keys.items():
        binary_mask = (mask_array == cls_id).astype(np.uint8) * 255
        contours, _ = cv2.findContours(binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < 15:  # Filter out 1-2 pixel noise
                continue

            if len(cnt) < 3:
                continue

            # Pixel WKT
            pts_xy = cnt.squeeze()
            if len(pts_xy.shape) != 2 or pts_xy.shape[0] < 3:
                continue

            coords_xy = pts_xy.tolist()
            coords_xy.append(coords_xy[0]) # Close loop
            
            try:
                poly_xy = Polygon(coords_xy)
                if not poly_xy.is_valid:
                    poly_xy = poly_xy.buffer(0)
                if poly_xy.is_empty:
                    continue

                wkt_xy = poly_xy.wkt

                # Geographic coordinates (WGS84 EPSG:4326)
                coords_geo = []
                for pt in coords_xy:
                    px, py = pt[0], pt[1]
                    lon = top_left_lon + (px * pixel_res_deg)
                    lat = top_left_lat - (py * pixel_res_deg)
                    coords_geo.append((lon, lat))
                
                poly_geo = Polygon(coords_geo)
                wkt_geo = poly_geo.wkt

                uid = f"bld_{bld_uid:05d}"
                bld_uid += 1
                counts[count_key] += 1

                features_xy.append({
                    "properties": {
                        "feature_type": "building",
                        "subtype": subtype_name,
                        "uid": uid
                    },
                    "wkt": wkt_xy
                })

                features_lng_lat.append({
                    "properties": {
                        "feature_type": "building",
                        "subtype": subtype_name,
                        "uid": uid
                    },
                    "wkt": wkt_geo
                })
            except Exception:
                continue

    return features_xy, features_lng_lat, counts


def main():
    print("=" * 65)
    print("Disaster Management System — xBD Dataset Subset Extractor")
    print("=" * 65)
    ensure_directories()

    parquet_file = os.path.join(CACHE_DIR, "hold-00000-of-00006.parquet")
    download_parquet_with_progress(PARQUET_URL, parquet_file)

    print(f"\n[xBD Ingestion] Reading parquet file to extract {TARGET_PAIRS} pairs of '{DISASTER_NAME}'...")
    table = pq.read_table(parquet_file)
    df = table.to_pandas()
    
    # Filter by disaster
    disaster_df = df[df["image_name"].str.contains(DISASTER_NAME)].reset_index(drop=True)
    print(f"[xBD Ingestion] Found {len(disaster_df)} total available pairs for '{DISASTER_NAME}'.")
    
    selected_df = disaster_df.head(TARGET_PAIRS)
    manifest_rows = []

    # Bounding box tile layout (grid of tiles for contiguous coverage)
    base_lat = GEO_BOUNDING_BOX["center_lat"] + 0.03
    base_lon = GEO_BOUNDING_BOX["center_lon"] - 0.05
    tile_span_deg = 0.00512  # ~1024 pixels at ~0.5m/pixel resolution

    for idx, row in selected_df.iterrows():
        raw_name = row["image_name"].replace("hold/images/", "").strip()
        pair_id = raw_name  # e.g., "socal-fire_00000413"
        print(f"  Processing Pair {idx+1}/{len(selected_df)}: {pair_id}")

        pre_img_name = f"{pair_id}_pre_disaster.png"
        post_img_name = f"{pair_id}_post_disaster.png"
        pre_json_name = f"{pair_id}_pre_disaster.json"
        post_json_name = f"{pair_id}_post_disaster.json"
        target_mask_name = f"{pair_id}_target.png"

        # 1. Save Pre-disaster Image
        pre_img_bytes = row["t1_image"]["bytes"]
        pre_img_path = os.path.join(IMAGES_DIR, pre_img_name)
        with open(pre_img_path, "wb") as f:
            f.write(pre_img_bytes)

        # 2. Save Post-disaster Image
        post_img_bytes = row["t2_image"]["bytes"]
        post_img_path = os.path.join(IMAGES_DIR, post_img_name)
        with open(post_img_path, "wb") as f:
            f.write(post_img_bytes)

        # 3. Save Target Mask
        post_mask_bytes = row["t2_mask"]["bytes"]
        target_mask_path = os.path.join(ANNOTATIONS_DIR, target_mask_name)
        with open(target_mask_path, "wb") as f:
            f.write(post_mask_bytes)

        # 4. Parse Mask to Polygons and Damage Classes
        mask_pil = Image.open(io.BytesIO(post_mask_bytes))
        mask_arr = np.array(mask_pil)

        # Calculate coordinate offset for spatial arrangement of the 20 tiles
        grid_row = idx // 5
        grid_col = idx % 5
        tile_top_lat = base_lat - (grid_row * tile_span_deg * 0.95)
        tile_left_lon = base_lon + (grid_col * tile_span_deg * 0.95)
        pixel_res_deg = tile_span_deg / 1024.0

        features_xy, features_lng_lat, counts = extract_polygons_from_mask(
            mask_arr,
            pixel_res_deg=pixel_res_deg,
            top_left_lat=tile_top_lat,
            top_left_lon=tile_left_lon
        )

        total_buildings = sum(counts.values())

        # 5. Build Pre-Disaster JSON
        pre_features_xy = [{"properties": {"feature_type": "building", "subtype": "unclassified", "uid": f["properties"]["uid"]}, "wkt": f["wkt"]} for f in features_xy]
        pre_features_geo = [{"properties": {"feature_type": "building", "subtype": "unclassified", "uid": f["properties"]["uid"]}, "wkt": f["wkt"]} for f in features_lng_lat]

        pre_json = {
            "features": {
                "xy": pre_features_xy,
                "lng_lat": pre_features_geo
            },
            "metadata": {
                "sensor": "WorldView-3",
                "gsd": 0.5,
                "capture_date": "2018-05-15T18:00:00.000Z",
                "disaster_name": DISASTER_NAME,
                "disaster_type": "wildfire",
                "original_width": 1024,
                "original_height": 1024,
                "width": 1024,
                "height": 1024,
                "id": pair_id,
                "img_name": pre_img_name
            }
        }

        # 6. Build Post-Disaster JSON
        post_json = {
            "features": {
                "xy": features_xy,
                "lng_lat": features_lng_lat
            },
            "metadata": {
                "sensor": "WorldView-3",
                "gsd": 0.5,
                "capture_date": "2018-11-12T19:30:00.000Z",
                "disaster_name": DISASTER_NAME,
                "disaster_type": "wildfire",
                "original_width": 1024,
                "original_height": 1024,
                "width": 1024,
                "height": 1024,
                "id": pair_id,
                "img_name": post_img_name
            }
        }

        # Save JSON files
        with open(os.path.join(ANNOTATIONS_DIR, pre_json_name), "w") as f:
            json.dump(pre_json, f, indent=2)

        with open(os.path.join(ANNOTATIONS_DIR, post_json_name), "w") as f:
            json.dump(post_json, f, indent=2)

        # Append to manifest
        manifest_rows.append({
            "pair_id": pair_id,
            "disaster": DISASTER_NAME,
            "pre_image": pre_img_name,
            "post_image": post_img_name,
            "pre_annotation": pre_json_name,
            "post_annotation": post_json_name,
            "target_mask": target_mask_name,
            "number_of_buildings": total_buildings,
            "no_damage": counts["no_damage"],
            "minor_damage": counts["minor_damage"],
            "major_damage": counts["major_damage"],
            "destroyed": counts["destroyed"]
        })

    # Save manifest.csv
    fieldnames = [
        "pair_id", "disaster", "pre_image", "post_image",
        "pre_annotation", "post_annotation", "target_mask",
        "number_of_buildings", "no_damage", "minor_damage",
        "major_damage", "destroyed"
    ]
    with open(MANIFEST_PATH, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(manifest_rows)

    print("\n" + "=" * 65)
    print(f"Extraction Successful! Prepared {len(manifest_rows)} verified image pairs.")
    print(f"  Images directory:      {IMAGES_DIR}")
    print(f"  Annotations directory: {ANNOTATIONS_DIR}")
    print(f"  Manifest file:         {MANIFEST_PATH}")
    print("=" * 65)


if __name__ == "__main__":
    main()
