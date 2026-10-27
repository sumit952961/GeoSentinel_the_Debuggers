import pyarrow.parquet as pq
import io
from PIL import Image

table = pq.read_table('data/cache/hold-00000-of-00006.parquet')
print('Num rows:', table.num_rows)
print('Column names:', table.column_names)

row0 = {col: table[col][0].as_py() for col in table.column_names}
print('Row 0 image_name:', row0['image_name'])
for k in ['t1_image', 't2_image', 't1_mask', 't2_mask']:
    val = row0[k]
    if isinstance(val, dict):
        b = val.get('bytes')
        if b:
            img = Image.open(io.BytesIO(b))
            print(f"  {k}: mode={img.mode}, size={img.size}, len={len(b)} bytes")
        else:
            print(f"  {k}: path={val.get('path')}")
