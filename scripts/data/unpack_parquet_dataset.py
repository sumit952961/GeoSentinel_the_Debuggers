"""
Unpack real disaster change detection pairs from parquet cache into physical PNG files on disk.
"""
import os
import io
import pyarrow.parquet as pq
from PIL import Image

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PARQUET_PATH = os.path.join(ROOT_DIR, "data", "cache", "hold-00000-of-00006.parquet")
OUTPUT_DIR = os.path.join(ROOT_DIR, "data", "global", "xbd_holdout")

os.makedirs(os.path.join(OUTPUT_DIR, "images"), exist_ok=True)
os.makedirs(os.path.join(OUTPUT_DIR, "masks"), exist_ok=True)

print("=" * 75)
print("UNPACKING PHYSICAL DISASTER DATASET FROM PARQUET CACHE")
print("=" * 75)

if not os.path.exists(PARQUET_PATH):
    print(f"Error: {PARQUET_PATH} not found.")
    exit(1)

table = pq.read_table(PARQUET_PATH)
num_rows = table.num_rows
print(f"Total disaster pairs in cache: {num_rows}")

extracted_count = 0

for i in range(num_rows):
    row = {col: table[col][i].as_py() for col in table.column_names}
    raw_name = row["image_name"] # e.g. hold/images/midwest-flooding_00000046
    base_name = os.path.basename(raw_name)
    
    # Save t1_image (pre-disaster)
    t1_bytes = row["t1_image"].get("bytes")
    if t1_bytes:
        img_pre = Image.open(io.BytesIO(t1_bytes))
        img_pre.save(os.path.join(OUTPUT_DIR, "images", f"{base_name}_pre_disaster.png"))
        
    # Save t2_image (post-disaster)
    t2_bytes = row["t2_image"].get("bytes")
    if t2_bytes:
        img_post = Image.open(io.BytesIO(t2_bytes))
        img_post.save(os.path.join(OUTPUT_DIR, "images", f"{base_name}_post_disaster.png"))
        
    # Save t2_mask (target damage mask)
    t2_mask_bytes = row["t2_mask"].get("bytes")
    if t2_mask_bytes:
        mask_post = Image.open(io.BytesIO(t2_mask_bytes))
        mask_post.save(os.path.join(OUTPUT_DIR, "masks", f"{base_name}_target.png"))
        
    extracted_count += 1
    if (i + 1) % 25 == 0 or (i + 1) == num_rows:
        print(f"  -> Extracted {i + 1}/{num_rows} pairs into {OUTPUT_DIR}")

print(f"\n[Unpack Complete] Successfully unpacked {extracted_count} disaster pairs into physical PNG images and masks.")
