"""
Run baseline evaluation on xBD test set with real metrics.
"""
import os, sys, json, time, csv
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'ai-service'))
import torch
import numpy as np
from app.cv.models import BuildingDamageUNet
from app.cv.metrics import compute_metrics, CLASS_NAMES
from app.cv.dataset import XBDDataset, create_disaster_aware_split

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data_dir = os.path.join(ROOT, 'data', 'xbd_subset_v2')
manifest = os.path.join(data_dir, 'manifest.csv')

print("=" * 70)
print("BASELINE MODEL EVALUATION (xBD Test Set)")
print("=" * 70)

# Read manifest
with open(manifest) as f:
    rows = list(csv.DictReader(f))
print(f"Total pairs in manifest: {len(rows)}")

# Count by disaster
disasters = {}
for r in rows:
    d = r.get('disaster', 'unknown')
    disasters[d] = disasters.get(d, 0) + 1
print(f"Disasters: {disasters}")

# Create split
train_pairs, val_pairs, test_pairs = create_disaster_aware_split(manifest, seed=42)
print(f"\nSplit: train={len(train_pairs)}, val={len(val_pairs)}, test={len(test_pairs)}")

# Load test dataset
test_ds = XBDDataset(test_pairs, data_dir, mode='pre_post', target_size=(512, 512), is_training=False)
print(f"Test dataset size: {len(test_ds)}")

# Load model
weights_path = os.path.join(ROOT, 'ai-service', 'models', 'unet_resnet34_pre_post.pth')
model = BuildingDamageUNet(mode='pre_post', num_classes=5)
state = torch.load(weights_path, map_location='cpu', weights_only=True)
model.load_state_dict(state, strict=False)
model.eval()

all_preds = []
all_targets = []
latencies = []

print("\nRunning inference on test tiles...")
with torch.no_grad():
    for i in range(len(test_ds)):
        sample = test_ds[i]
        img = sample['image'].unsqueeze(0)
        gt = sample['mask'].numpy()

        t0 = time.perf_counter()
        out = model(img)
        latency = (time.perf_counter() - t0) * 1000
        latencies.append(latency)

        pred = torch.argmax(out, dim=1).squeeze(0).numpy()
        all_preds.extend(pred.flatten())
        all_targets.extend(gt.flatten())

        print(f"  Tile {i+1}/{len(test_ds)} | Latency: {latency:.0f}ms | Pair: {sample.get('pair_id', 'N/A')}")

metrics = compute_metrics(np.array(all_targets), np.array(all_preds))

print(f"\n{'='*70}")
print(f"RESULTS")
print(f"{'='*70}")
print(f"Test tiles:        {len(test_ds)}")
oa = metrics['overall_accuracy']
miou = metrics['mean_iou']
bmiou = metrics['building_mean_iou']
mf1 = metrics['macro_f1']
bf1 = metrics['building_macro_f1']
print(f"Overall Accuracy:  {oa*100:.2f}%")
print(f"Mean IoU:          {miou*100:.2f}%")
print(f"Building mIoU:     {bmiou*100:.2f}%")
print(f"Macro F1:          {mf1*100:.2f}%")
print(f"Building F1:       {bf1*100:.2f}%")
print(f"Avg Latency:       {np.mean(latencies):.1f}ms (CPU)")

print(f"\nPer-Class Metrics:")
header = f"  {'Class':<15} | {'Prec':>6} | {'Rec':>6} | {'F1':>6} | {'IoU':>6} | {'Support':>10}"
print(header)
print(f"  {'-'*65}")
for c in range(5):
    pc = metrics['per_class'][c]
    p = pc['precision']*100
    r = pc['recall']*100
    f = pc['f1']*100
    iou = pc['iou']*100
    s = pc['support']
    print(f"  {CLASS_NAMES[c]:<15} | {p:5.1f}% | {r:5.1f}% | {f:5.1f}% | {iou:5.1f}% | {s:>10}")

print(f"\nConfusion Matrix:")
cm = np.array(metrics['confusion_matrix'])
print(f"  {'':>15}", end='')
for c in range(5):
    print(f"  {CLASS_NAMES[c]:>12}", end='')
print()
for row in range(5):
    print(f"  {CLASS_NAMES[row]:>15}", end='')
    for col in range(5):
        print(f"  {cm[row,col]:>12}", end='')
    print()

# Save
results = {
    'model': 'unet_resnet34_pre_post (xBD baseline)',
    'model_path': weights_path,
    'test_tiles': len(test_ds),
    'total_manifest_pairs': len(rows),
    'disasters_in_dataset': disasters,
    'split': {'train': len(train_pairs), 'val': len(val_pairs), 'test': len(test_pairs)},
    'metrics': metrics,
    'latency_ms': {
        'mean': float(np.mean(latencies)),
        'std': float(np.std(latencies)),
        'min': float(np.min(latencies)),
        'max': float(np.max(latencies))
    },
    'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S')
}
out_dir = os.path.join(ROOT, 'outputs', 'india_evaluation')
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, 'baseline_xbd_metrics.json')
with open(out_path, 'w') as f:
    json.dump(results, f, indent=2, default=str)
print(f"\nSaved to {out_path}")
