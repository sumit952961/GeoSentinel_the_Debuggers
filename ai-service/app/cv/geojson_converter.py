"""
============================================================
Disaster Management System — Segmentation Mask to GeoJSON
============================================================

Implements:
  segmentation mask -> contours/polygons -> GeoJSON FeatureCollection
"""

import cv2
import numpy as np
from shapely.geometry import Polygon, mapping
import json


DAMAGE_CLASS_NAMES = {
    1: "no-damage",
    2: "minor-damage",
    3: "major-damage",
    4: "destroyed"
}


def mask_to_geojson(pred_mask, prob_map=None, base_lat=34.0522, base_lon=-118.6850, res_meters=0.5):
    """
    Transforms integer segmentation mask into standard GeoJSON FeatureCollection.
    
    Args:
      pred_mask: 2D numpy array of class integers (0..4)
      prob_map: (optional) 3D numpy array of class probabilities (C, H, W)
      base_lat, base_lon: Center reference point for geographical anchoring
      res_meters: Ground sample distance per pixel (~0.5m)
      
    Returns:
      dict: GeoJSON FeatureCollection
    """
    h, w = pred_mask.shape
    meters_per_deg = 111320.0
    deg_per_px_lat = res_meters / meters_per_deg
    deg_per_px_lon = res_meters / (meters_per_deg * np.cos(np.radians(base_lat)))
    
    features = []
    feature_counter = 1
    
    for class_id in range(1, 5):
        binary = (pred_mask == class_id).astype(np.uint8)
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for cnt in contours:
            area_px = cv2.contourArea(cnt)
            if area_px < 15:  # filter noise below 15 pixels (~3.75 m^2)
                continue
                
            pts = cnt.squeeze()
            if len(pts.shape) != 2 or len(pts) < 3:
                continue
                
            pts_list = pts.tolist()
            if pts_list[0] != pts_list[-1]:
                pts_list.append(pts_list[0])
                
            # Geo coordinates conversion
            geo_coords = []
            for p in pts_list:
                x, y = p[0], p[1]
                lon = base_lon + (x - (w / 2.0)) * deg_per_px_lon
                lat = base_lat - (y - (h / 2.0)) * deg_per_px_lat
                geo_coords.append((round(lon, 7), round(lat, 7)))
                
            try:
                poly = Polygon(geo_coords)
                if not poly.is_valid:
                    poly = poly.buffer(0)
                if poly.is_empty:
                    continue
            except Exception:
                continue
                
            # Compute confidence score
            conf = 0.85
            if prob_map is not None:
                mask_cnt = np.zeros((h, w), dtype=np.uint8)
                cv2.drawContours(mask_cnt, [cnt], -1, 1, -1)
                cnt_probs = prob_map[class_id][mask_cnt == 1]
                if len(cnt_probs) > 0:
                    conf = float(np.mean(cnt_probs))
                    
            feat = {
                "type": "Feature",
                "id": feature_counter,
                "geometry": mapping(poly),
                "properties": {
                    "feature_id": feature_counter,
                    "building_type": "building",
                    "damage_class": DAMAGE_CLASS_NAMES[class_id],
                    "damage_class_id": class_id,
                    "confidence": round(conf, 4),
                    "area_sq_meters": round(float(area_px * (res_meters ** 2)), 2),
                    "model_version": "unet_resnet34_v1"
                }
            }
            features.append(feat)
            feature_counter += 1
            
    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "total_buildings_detected": len(features),
            "damage_breakdown": {
                "no_damage": sum(1 for f in features if f["properties"]["damage_class_id"] == 1),
                "minor_damage": sum(1 for f in features if f["properties"]["damage_class_id"] == 2),
                "major_damage": sum(1 for f in features if f["properties"]["damage_class_id"] == 3),
                "destroyed": sum(1 for f in features if f["properties"]["damage_class_id"] == 4)
            }
        }
    }
