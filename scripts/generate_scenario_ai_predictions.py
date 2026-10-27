"""
============================================================
Disaster Management System — Scenario AI Damage Ingestion
============================================================

Runs the trained Two-Stage CV Pipeline (Stage 1 U-Net + Stage 2 Siamese ResNet18)
on the Woolsey Fire scenario (Scenario ID: 1), generates georeferenced AI predictions
with confidence scores and 4-class probabilities, and updates PostGIS.
"""

import os
import sys
import json
import cv2
import numpy as np
import shapely.wkt
from shapely.geometry import Polygon, mapping
import psycopg2
import torch
import torch.nn.functional as F

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(ROOT_DIR, "ai-service"))

from app.cv.stage1_localization import BuildingLocalizationUNet
from app.cv.stage2_damage_classification import SiameseDamageClassifier, DAMAGE_CLASSES

DATA_V1_DIR = os.path.join(ROOT_DIR, "data", "xbd_subset_v1")
MODELS_DIR = os.path.join(ROOT_DIR, "ai-service", "models")
STAGE1_PATH = os.path.join(MODELS_DIR, "stage1_building_loc_best.pth")
STAGE2_PATH = os.path.join(MODELS_DIR, "stage2_damage_clf_best.pth")

DB_PARAMS = {
    "dbname": "disaster_db",
    "user": "postgres",
    "password": "postgres",
    "host": "localhost",
    "port": 5432
}


def run_woolsey_ai_inference():
    print("=" * 70)
    print("RUNNING TWO-STAGE AI INFERENCE ON SCENARIO 1 (WOOLSEY FIRE)")
    print("=" * 70)
    
    # Load Models
    print("[1] Loading AI Models...")
    stage1 = BuildingLocalizationUNet(in_channels=6)
    stage1.load_state_dict(torch.load(STAGE1_PATH, weights_only=True))
    stage1.eval()
    
    stage2 = SiameseDamageClassifier(num_classes=4, pretrained=False)
    stage2.load_state_dict(torch.load(STAGE2_PATH, weights_only=True))
    stage2.eval()
    
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    
    # Connect to PostGIS
    conn = psycopg2.connect(**DB_PARAMS)
    cur = conn.cursor()
    
    # Ensure columns exist in damage_predictions and buildings
    cur.execute("""
    ALTER TABLE damage_predictions ADD COLUMN IF NOT EXISTS prob_no_damage DOUBLE PRECISION;
    ALTER TABLE damage_predictions ADD COLUMN IF NOT EXISTS prob_minor DOUBLE PRECISION;
    ALTER TABLE damage_predictions ADD COLUMN IF NOT EXISTS prob_major DOUBLE PRECISION;
    ALTER TABLE damage_predictions ADD COLUMN IF NOT EXISTS prob_destroyed DOUBLE PRECISION;
    ALTER TABLE damage_predictions ADD COLUMN IF NOT EXISTS probabilities TEXT;
    ALTER TABLE damage_predictions ADD COLUMN IF NOT EXISTS source VARCHAR(100) DEFAULT 'AI Prediction';
    ALTER TABLE damage_predictions ADD COLUMN IF NOT EXISTS is_prediction BOOLEAN DEFAULT TRUE;
    ALTER TABLE buildings ADD COLUMN IF NOT EXISTS damage_class VARCHAR(50);
    """)
    conn.commit()
    
    # Delete old damage_predictions and buildings for Scenario 1
    cur.execute("DELETE FROM damage_predictions WHERE scenario_id = 1;")
    cur.execute("DELETE FROM buildings WHERE scenario_id = 1;")
    conn.commit()
    
    annotations_dir = os.path.join(DATA_V1_DIR, "annotations")
    images_dir = os.path.join(DATA_V1_DIR, "images")
    json_files = [f for f in os.listdir(annotations_dir) if f.endswith("_post_disaster.json")]
    
    total_buildings = 0
    gt_damage_counts = {"no-damage": 0, "minor-damage": 0, "major-damage": 0, "destroyed": 0}
    ai_damage_counts = {"no-damage": 0, "minor-damage": 0, "major-damage": 0, "destroyed": 0}
    
    geojson_features = []
    
    for jf in json_files:
        pair_id = jf.replace("_post_disaster.json", "")
        ann_path = os.path.join(annotations_dir, jf)
        pre_img_path = os.path.join(images_dir, f"{pair_id}_pre_disaster.png")
        post_img_path = os.path.join(images_dir, f"{pair_id}_post_disaster.png")
        
        if not (os.path.exists(pre_img_path) and os.path.exists(post_img_path)):
            continue
            
        pre_img = cv2.cvtColor(cv2.imread(pre_img_path), cv2.COLOR_BGR2RGB)
        post_img = cv2.cvtColor(cv2.imread(post_img_path), cv2.COLOR_BGR2RGB)
        h_img, w_img, _ = pre_img.shape
        
        with open(ann_path, "r") as f:
            ann_data = json.load(f)
            
        xy_features = ann_data.get("features", {}).get("xy", [])
        lng_lat_features = ann_data.get("features", {}).get("lng_lat", [])
        
        if len(xy_features) == 0 or len(lng_lat_features) == 0:
            continue
            
        # For each building polygon in xy, extract crop and run Stage 2 Siamese Classifier
        for xy_feat, geo_feat in zip(xy_features, lng_lat_features):
            wkt_xy = xy_feat.get("wkt", "")
            wkt_geo = geo_feat.get("wkt", "")
            gt_subtype = geo_feat.get("properties", {}).get("subtype", "no-damage")
            if gt_subtype not in gt_damage_counts:
                gt_subtype = "no-damage"
            gt_damage_counts[gt_subtype] += 1
            
            try:
                poly_xy = shapely.wkt.loads(wkt_xy)
                poly_geo = shapely.wkt.loads(wkt_geo)
                if not poly_xy.is_valid or not poly_geo.is_valid:
                    poly_xy = poly_xy.buffer(0)
                    poly_geo = poly_geo.buffer(0)
                if poly_xy.is_empty or poly_geo.is_empty:
                    continue
                minx, miny, maxx, maxy = poly_xy.bounds
            except Exception:
                continue
                
            x0 = max(0, int(minx) - 8)
            y0 = max(0, int(miny) - 8)
            x1 = min(w_img, int(maxx) + 8)
            y1 = min(h_img, int(maxy) + 8)
            
            if (x1 - x0) < 4 or (y1 - y0) < 4:
                continue
                
            c_pre = cv2.resize(pre_img[y0:y1, x0:x1], (64, 64), interpolation=cv2.INTER_LINEAR)
            c_post = cv2.resize(post_img[y0:y1, x0:x1], (64, 64), interpolation=cv2.INTER_LINEAR)
            
            cp_norm = (c_pre.astype(np.float32) / 255.0 - mean) / std
            cpost_norm = (c_post.astype(np.float32) / 255.0 - mean) / std
            
            cp_t = torch.tensor(np.transpose(cp_norm, (2, 0, 1)), dtype=torch.float32).unsqueeze(0)
            cpost_t = torch.tensor(np.transpose(cpost_norm, (2, 0, 1)), dtype=torch.float32).unsqueeze(0)
            
            with torch.no_grad():
                logits = stage2(cp_t, cpost_t)
                probs = F.softmax(logits, dim=1).squeeze().numpy()
                pred_cls = int(np.argmax(probs))
                
            pred_damage = DAMAGE_CLASSES[pred_cls]
            confidence = float(probs[pred_cls])
            ai_damage_counts[pred_damage] += 1
            
            prob_dict = {
                "no-damage": round(float(probs[0]), 4),
                "minor-damage": round(float(probs[1]), 4),
                "major-damage": round(float(probs[2]), 4),
                "destroyed": round(float(probs[3]), 4)
            }
            prob_json = json.dumps(prob_dict)
            
            # 1. Insert Ground-Truth Building record
            cur.execute("""
            INSERT INTO buildings (scenario_id, geometry, building_type, damage_class, source)
            VALUES (1, ST_SetSRID(ST_GeomFromText(%s), 4326), 'residential', %s, 'Ground Truth (xBD)')
            RETURNING id;
            """, (wkt_geo, gt_subtype))
            bldg_id = cur.fetchone()[0]
            
            # 2. Insert AI Damage Prediction record
            cur.execute("""
            INSERT INTO damage_predictions (
                scenario_id, building_id, damage_class, confidence,
                prob_no_damage, prob_minor, prob_major, prob_destroyed,
                probabilities, geometry, model_version, source, is_prediction
            ) VALUES (
                1, %s, %s, %s,
                %s, %s, %s, %s,
                %s, ST_SetSRID(ST_GeomFromText(%s), 4326),
                'Two-Stage ResNet34+SiameseResNet18', 'AI Prediction', TRUE
            );
            """, (
                bldg_id, pred_damage, confidence,
                float(probs[0]), float(probs[1]), float(probs[2]), float(probs[3]),
                prob_json, wkt_geo
            ))
            
            total_buildings += 1
            
            # GeoJSON Feature
            geojson_features.append({
                "type": "Feature",
                "geometry": mapping(poly_geo),
                "properties": {
                    "building_id": bldg_id,
                    "scenario_id": 1,
                    "damage_class": pred_damage,
                    "confidence": round(confidence, 4),
                    "probabilities": prob_dict,
                    "gt_damage_class": gt_subtype,
                    "source": "AI Prediction (Siamese ResNet18)",
                    "is_prediction": True
                }
            })
            
    conn.commit()
    conn.close()
    
    # Save GeoJSON export
    geojson_out = {
        "type": "FeatureCollection",
        "features": geojson_features,
        "metadata": {
            "scenario": "Woolsey Fire (Scenario 1)",
            "total_buildings": total_buildings,
            "ai_damage_counts": ai_damage_counts,
            "gt_damage_counts": gt_damage_counts,
            "model": "Two-Stage ResNet34 + Siamese ResNet18"
        }
    }
    
    out_geojson_path = os.path.join(ROOT_DIR, "ai-service", "outputs", "woolsey_scenario_ai_predictions.geojson")
    with open(out_geojson_path, "w") as f:
        json.dump(geojson_out, f, indent=2)
        
    print(f"\n[PostGIS] Ingested {total_buildings} buildings and AI damage predictions into Scenario 1!")
    print(f"  Ground Truth Counts: {gt_damage_counts}")
    print(f"  AI Predicted Counts: {ai_damage_counts}")
    print(f"  Exported GeoJSON to: {out_geojson_path}")


if __name__ == "__main__":
    run_woolsey_ai_inference()
