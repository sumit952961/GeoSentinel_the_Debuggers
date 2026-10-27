import os
import io
import json
import pyarrow.parquet as pq
import pandas as pd
from collections import Counter, defaultdict

CACHE_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "cache", "hold-00000-of-00006.parquet")

def inspect_cached_parquet():
    print(f"Reading {CACHE_FILE}...")
    table = pq.read_table(CACHE_FILE)
    print(f"Total rows in parquet: {table.num_rows}")
    df = table.to_pandas()
    
    # Analyze disaster types and masks in this parquet
    disaster_stats = defaultdict(lambda: Counter())
    pair_details = []
    
    for idx, row in df.iterrows():
        img_name = row['image_name']
        parts = img_name.split('/')[-1].split('_')
        disaster = parts[0]
        pair_num = parts[1]
        
        # Check masks or annotations
        # In this dataset, t2_mask contains png bytes of damage mask where pixel values represent classes
        import numpy as np
        from PIL import Image
        
        t2_mask_bytes = row['t2_mask']['bytes'] if 't2_mask' in row and row['t2_mask'] else None
        class_counts = Counter()
        if t2_mask_bytes:
            mask_img = np.array(Image.open(io.BytesIO(t2_mask_bytes)))
            unique, counts = np.unique(mask_img, return_counts=True)
            for u, c in zip(unique, counts):
                class_counts[int(u)] = int(c)
                disaster_stats[disaster][int(u)] += int(c)
        
        pair_details.append({
            "idx": idx,
            "disaster": disaster,
            "pair_id": f"{disaster}_{pair_num}",
            "classes_present": list(class_counts.keys()),
            "pixel_counts": dict(class_counts)
        })
        
    print("\n" + "=" * 60)
    print("DISASTERS FOUND IN CACHED PARQUET:")
    print("=" * 60)
    for d, counts in sorted(disaster_stats.items()):
        total_building_pixels = sum(counts[c] for c in [1, 2, 3, 4])
        print(f"Disaster: {d:<25} | Pixels -> No-Dam(1): {counts[1]:<8} | Minor(2): {counts[2]:<8} | Major(3): {counts[3]:<8} | Destr(4): {counts[4]:<8}")

if __name__ == "__main__":
    inspect_cached_parquet()
