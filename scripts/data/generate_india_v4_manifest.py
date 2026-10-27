"""
============================================================
DRAS Model V4 Master Manifest Generator & Strict Path Validator
============================================================
Generates data/india_v4_manifest.csv where:
  - Every single row corresponds to real physical files on disk
  - Path existence is verified before inclusion
  - Required columns match specification exactly
"""

import os
import csv
import glob

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MANIFEST_PATH = os.path.join(ROOT_DIR, "data", "india_v4_manifest.csv")

FIELDNAMES = [
    "event_id",
    "event_name",
    "country",
    "latitude",
    "longitude",
    "sensor",
    "resolution",
    "pre_image",
    "post_image",
    "building_annotation",
    "damage_annotation",
    "annotation_type",
    "label_quality",
    "source",
    "license",
    "split",
    "usable_for_stage1",
    "usable_for_stage2"
]

rows = []

# 1. Indian Events (Chamoli, Fani, Dharali)
events_meta = {
    "chamoli_2021": {
        "name": "Chamoli Flash Flood 2021",
        "country": "India",
        "lat": 30.55, "lon": 79.73,
        "sensor": "Sentinel-2 L2A",
        "resolution": "10m",
        "annotation_type": "raster_polygon_mask",
        "label_quality": "EXACT",
        "source": "NERC EIDC Westoby et al. (2023)",
        "license": "Open Government Licence v3.0",
        "split": "train",
        "usable_s1": True,
        "usable_s2": True
    },
    "fani_2019": {
        "name": "Cyclone Fani 2019",
        "country": "India",
        "lat": 19.81, "lon": 85.83,
        "sensor": "Sentinel-2 MSI",
        "resolution": "10m",
        "annotation_type": "raster_point_mask",
        "label_quality": "EXACT",
        "source": "Copernicus EMSR357",
        "license": "Copernicus Open Access",
        "split": "train",
        "usable_s1": True,
        "usable_s2": True
    },
    "dharali_2025": {
        "name": "Dharali Flash Flood 2025",
        "country": "India",
        "lat": 31.04, "lon": 78.78,
        "sensor": "Sentinel-2 L2A",
        "resolution": "10m",
        "annotation_type": "hazard_extent_overlay",
        "label_quality": "WEAK",
        "source": "ISRO NRSC Bhuvan",
        "license": "ISRO Open Data Policy",
        "split": "test",
        "usable_s1": True,
        "usable_s2": False  # Honestly withheld: zero building damage ground truth
    }
}

for ev_id, ev_info in events_meta.items():
    ev_dir = os.path.join(ROOT_DIR, "data", "india", ev_id)
    pre_dir = os.path.join(ev_dir, "processed", "images_pre")
    post_dir = os.path.join(ev_dir, "processed", "images_post")
    mask_dir = os.path.join(ev_dir, "processed", "masks")
    
    if os.path.exists(pre_dir) and os.path.exists(mask_dir):
        for f in sorted(os.listdir(pre_dir)):
            if f.endswith("_pre.png"):
                base = f.replace("_pre.png", "")
                pre_rel = os.path.join("data", "india", ev_id, "processed", "images_pre", f).replace("\\", "/")
                post_rel = os.path.join("data", "india", ev_id, "processed", "images_post", f.replace("_pre.", "_post.")).replace("\\", "/")
                mask_rel = os.path.join("data", "india", ev_id, "processed", "masks", base + "_mask.png").replace("\\", "/")
                
                # Verify physical existence
                if os.path.exists(os.path.join(ROOT_DIR, pre_rel)) and \
                   os.path.exists(os.path.join(ROOT_DIR, post_rel)) and \
                   os.path.exists(os.path.join(ROOT_DIR, mask_rel)):
                    rows.append({
                        "event_id": ev_id,
                        "event_name": ev_info["name"],
                        "country": ev_info["country"],
                        "latitude": ev_info["lat"],
                        "longitude": ev_info["lon"],
                        "sensor": ev_info["sensor"],
                        "resolution": ev_info["resolution"],
                        "pre_image": pre_rel,
                        "post_image": post_rel,
                        "building_annotation": mask_rel,
                        "damage_annotation": mask_rel if ev_info["usable_s2"] else "none",
                        "annotation_type": ev_info["annotation_type"],
                        "label_quality": ev_info["label_quality"],
                        "source": ev_info["source"],
                        "license": ev_info["license"],
                        "split": ev_info["split"],
                        "usable_for_stage1": ev_info["usable_s1"],
                        "usable_for_stage2": ev_info["usable_s2"]
                    })

# 2. xBD Subset v2 (Global Pretraining Pairs)
xbd_img_dir = os.path.join(ROOT_DIR, "data", "xbd_subset_v2", "images")
xbd_mask_dir = os.path.join(ROOT_DIR, "data", "xbd_subset_v2", "masks")
xbd_ann_dir = os.path.join(ROOT_DIR, "data", "xbd_subset_v2", "annotations")

if os.path.exists(xbd_img_dir) and os.path.exists(xbd_mask_dir):
    for f in sorted(os.listdir(xbd_img_dir)):
        if f.endswith("_pre_disaster.png"):
            pair_base = f.replace("_pre_disaster.png", "")
            pre_rel = os.path.join("data", "xbd_subset_v2", "images", f).replace("\\", "/")
            post_rel = os.path.join("data", "xbd_subset_v2", "images", pair_base + "_post_disaster.png").replace("\\", "/")
            mask_rel = os.path.join("data", "xbd_subset_v2", "masks", pair_base + "_target.png").replace("\\", "/")
            ann_rel = os.path.join("data", "xbd_subset_v2", "annotations", pair_base + "_post_disaster.json").replace("\\", "/")
            
            if os.path.exists(os.path.join(ROOT_DIR, pre_rel)) and \
               os.path.exists(os.path.join(ROOT_DIR, post_rel)) and \
               os.path.exists(os.path.join(ROOT_DIR, mask_rel)):
                has_ann = os.path.exists(os.path.join(ROOT_DIR, ann_rel))
                rows.append({
                    "event_id": f"xbd_{pair_base.split('_')[0]}",
                    "event_name": f"xBD Global {pair_base.split('_')[0].replace('-', ' ').title()}",
                    "country": "Global",
                    "latitude": 0.0,
                    "longitude": 0.0,
                    "sensor": "WorldView-2/3",
                    "resolution": "0.5m",
                    "pre_image": pre_rel,
                    "post_image": post_rel,
                    "building_annotation": mask_rel,
                    "damage_annotation": ann_rel if has_ann else mask_rel,
                    "annotation_type": "vector_polygon_geojson" if has_ann else "raster_mask",
                    "label_quality": "EXACT",
                    "source": "xView2 Challenge / DIU",
                    "license": "CC BY-NC 4.0",
                    "split": "pretrain",
                    "usable_for_stage1": True,
                    "usable_for_stage2": True
                })

# 3. Global Holdout / BRIGHT cache (156 pairs)
glob_img_dir = os.path.join(ROOT_DIR, "data", "global", "xbd_holdout", "images")
glob_mask_dir = os.path.join(ROOT_DIR, "data", "global", "xbd_holdout", "masks")
if os.path.exists(glob_img_dir) and os.path.exists(glob_mask_dir):
    for f in sorted(os.listdir(glob_img_dir)):
        if f.endswith("_pre_disaster.png"):
            pair_base = f.replace("_pre_disaster.png", "")
            pre_rel = os.path.join("data", "global", "xbd_holdout", "images", f).replace("\\", "/")
            post_rel = os.path.join("data", "global", "xbd_holdout", "images", pair_base + "_post_disaster.png").replace("\\", "/")
            mask_rel = os.path.join("data", "global", "xbd_holdout", "masks", pair_base + "_target.png").replace("\\", "/")
            
            if os.path.exists(os.path.join(ROOT_DIR, pre_rel)) and \
               os.path.exists(os.path.join(ROOT_DIR, post_rel)) and \
               os.path.exists(os.path.join(ROOT_DIR, mask_rel)):
                rows.append({
                    "event_id": f"global_{pair_base.split('_')[0]}",
                    "event_name": f"Global Disaster {pair_base.split('_')[0].replace('-', ' ').title()}",
                    "country": "Global",
                    "latitude": 0.0,
                    "longitude": 0.0,
                    "sensor": "WorldView / Sentinel",
                    "resolution": "0.5m-10m",
                    "pre_image": pre_rel,
                    "post_image": post_rel,
                    "building_annotation": mask_rel,
                    "damage_annotation": mask_rel,
                    "annotation_type": "raster_mask",
                    "label_quality": "EXACT",
                    "source": "BRIGHT / xBD Cache",
                    "license": "CC BY 4.0",
                    "split": "pretrain",
                    "usable_for_stage1": True,
                    "usable_for_stage2": True
                })

print(f"Total physically verified disaster pairs collected: {len(rows)}")

# Write to CSV
with open(MANIFEST_PATH, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
    writer.writeheader()
    writer.writerows(rows)

print(f"Successfully generated {MANIFEST_PATH}")
