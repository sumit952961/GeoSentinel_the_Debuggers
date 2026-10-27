import os
import io
import pyarrow.parquet as pq
import pandas as pd
import numpy as np
from PIL import Image
from collections import Counter, defaultdict

CACHE_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "cache", "hold-00000-of-00006.parquet")

def analyze_disaster_pairs():
    table = pq.read_table(CACHE_FILE)
    df = table.to_pandas()
    
    disaster_pairs = defaultdict(list)
    
    for idx, row in df.iterrows():
        img_name = row['image_name']
        parts = img_name.split('/')[-1].split('_')
        disaster = parts[0]
        pair_num = parts[1]
        
        t2_mask_bytes = row['t2_mask']['bytes'] if 't2_mask' in row and row['t2_mask'] else None
        
        counts = Counter()
        if t2_mask_bytes:
            mask_img = np.array(Image.open(io.BytesIO(t2_mask_bytes)))
            unique, ucounts = np.unique(mask_img, return_counts=True)
            for u, c in zip(unique, ucounts):
                counts[int(u)] = int(c)
                
        disaster_pairs[disaster].append({
            "idx": idx,
            "pair_id": f"{disaster}_{pair_num}",
            "no_damage_pixels": counts.get(1, 0),
            "minor_damage_pixels": counts.get(2, 0),
            "major_damage_pixels": counts.get(3, 0),
            "destroyed_pixels": counts.get(4, 0),
            "has_no_damage": counts.get(1, 0) > 0,
            "has_minor": counts.get(2, 0) > 0,
            "has_major": counts.get(3, 0) > 0,
            "has_destroyed": counts.get(4, 0) > 0,
        })
        
    print("=" * 75)
    print("PAIR COUNTS & DAMAGE DISTRIBUTION PER DISASTER IN CACHED PARQUET:")
    print("=" * 75)
    
    for disaster, pairs in sorted(disaster_pairs.items()):
        total_p = len(pairs)
        n_minor = sum(1 for p in pairs if p['has_minor'])
        n_major = sum(1 for p in pairs if p['has_major'])
        n_destr = sum(1 for p in pairs if p['has_destroyed'])
        n_nodam = sum(1 for p in pairs if p['has_no_damage'])
        
        tot_1 = sum(p['no_damage_pixels'] for p in pairs)
        tot_2 = sum(p['minor_damage_pixels'] for p in pairs)
        tot_3 = sum(p['major_damage_pixels'] for p in pairs)
        tot_4 = sum(p['destroyed_pixels'] for p in pairs)
        
        print(f"\nDisaster: {disaster}")
        print(f"  Total Pairs: {total_p}")
        print(f"  Pairs with No-Damage: {n_nodam} | Minor: {n_minor} | Major: {n_major} | Destroyed: {n_destr}")
        print(f"  Total Pixels -> No-Dam: {tot_1:,} | Minor: {tot_2:,} | Major: {tot_3:,} | Destr: {tot_4:,}")

if __name__ == "__main__":
    analyze_disaster_pairs()
