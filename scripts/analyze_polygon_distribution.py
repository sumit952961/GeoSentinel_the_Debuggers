import os
import io
import json
import pyarrow.parquet as pq
import pandas as pd
import numpy as np
from PIL import Image
from collections import Counter, defaultdict

CACHE_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "cache", "hold-00000-of-00006.parquet")

def analyze_polygon_and_pixel_distribution():
    table = pq.read_table(CACHE_FILE)
    df = table.to_pandas()
    
    disaster_stats = defaultdict(lambda: {
        "pairs": 0,
        "nodam_bldg": 0,
        "minor_bldg": 0,
        "major_bldg": 0,
        "destr_bldg": 0,
        "total_bldg": 0,
        "nodam_px": 0,
        "minor_px": 0,
        "major_px": 0,
        "destr_px": 0
    })
    
    pair_rows = []
    
    for idx, row in df.iterrows():
        img_name = row['image_name']
        parts = img_name.split('/')[-1].split('_')
        disaster = parts[0]
        pair_num = parts[1]
        
        t2_mask_bytes = row['t2_mask']['bytes'] if 't2_mask' in row and row['t2_mask'] else None
        
        px_counts = Counter()
        if t2_mask_bytes:
            mask_img = np.array(Image.open(io.BytesIO(t2_mask_bytes)))
            unique, ucounts = np.unique(mask_img, return_counts=True)
            for u, c in zip(unique, ucounts):
                px_counts[int(u)] = int(c)
        
        # We can extract polygon annotations from the target mask by finding connected components per class
        # Or count distinct building regions
        import cv2
        bldg_counts = Counter()
        if t2_mask_bytes:
            for cls_id in [1, 2, 3, 4]:
                binary_mask = (mask_img == cls_id).astype(np.uint8)
                num_labels, labels_im = cv2.connectedComponents(binary_mask)
                # num_labels includes background (0), so subtract 1 if > 0
                count = max(0, num_labels - 1)
                bldg_counts[cls_id] = count
                
        stats = disaster_stats[disaster]
        stats["pairs"] += 1
        stats["nodam_bldg"] += bldg_counts[1]
        stats["minor_bldg"] += bldg_counts[2]
        stats["major_bldg"] += bldg_counts[3]
        stats["destr_bldg"] += bldg_counts[4]
        stats["total_bldg"] += sum(bldg_counts.values())
        stats["nodam_px"] += px_counts.get(1, 0)
        stats["minor_px"] += px_counts.get(2, 0)
        stats["major_px"] += px_counts.get(3, 0)
        stats["destr_px"] += px_counts.get(4, 0)
        
        pair_rows.append({
            "idx": idx,
            "disaster": disaster,
            "pair_id": f"{disaster}_{pair_num}",
            "bldg_1": bldg_counts[1],
            "bldg_2": bldg_counts[2],
            "bldg_3": bldg_counts[3],
            "bldg_4": bldg_counts[4],
            "bldg_total": sum(bldg_counts.values()),
            "px_1": px_counts.get(1, 0),
            "px_2": px_counts.get(2, 0),
            "px_3": px_counts.get(3, 0),
            "px_4": px_counts.get(4, 0)
        })
        
    print("=" * 80)
    print("SUMMARY PER DISASTER (Pair counts & Building polygon instances):")
    print("=" * 80)
    print(f"{'Disaster':<25} | {'Pairs':<5} | {'No-Dam':<8} | {'Minor':<8} | {'Major':<8} | {'Destr':<8} | {'Total Bldg':<10}")
    print("-" * 80)
    for d, s in sorted(disaster_stats.items()):
        print(f"{d:<25} | {s['pairs']:<5} | {s['nodam_bldg']:<8} | {s['minor_bldg']:<8} | {s['major_bldg']:<8} | {s['destr_bldg']:<8} | {s['total_bldg']:<10}")
        
    return pair_rows, disaster_stats

if __name__ == "__main__":
    analyze_polygon_and_pixel_distribution()
