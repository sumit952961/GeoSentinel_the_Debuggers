import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT_DIR, "ai-service"))

from app.api.cv import predict_pair, PredictPairRequest

print("=" * 70)
print("TESTING FASTAPI /api/cv/predict-pair ENDPOINT")
print("=" * 70)

# Pick a real pair from data/xbd_subset_v2/images
img_dir = os.path.join(ROOT_DIR, "data", "xbd_subset_v2", "images")
pairs = [f.replace("_post_disaster.png", "") for f in os.listdir(img_dir) if f.endswith("_post_disaster.png")]

if pairs:
    test_pair = pairs[0]
    print(f"Testing with real pair: {test_pair} and mode='dras_india_v3'")
    req = PredictPairRequest(pair_id=test_pair, mode="dras_india_v3", base_lat=30.55, base_lon=79.75)
    res = predict_pair(req)
    
    print("\nInference Result:")
    print(f"  Total Buildings Detected: {res['metadata']['total_buildings_detected']}")
    print(f"  Damage Breakdown: {res['metadata'].get('damage_breakdown')}")
    print(f"  Inference Latency: {res['metadata']['inference_latency_ms']} ms")
    print(f"  Model Version: {res['metadata'].get('model_version')}")
    print(f"  Dataset Version: {res['metadata'].get('dataset_version')}")
    print(f"  Features Count: {len(res['features'])}")
    if res['features']:
        print(f"  Sample Feature Damage: {res['features'][0]['properties']['damage_class']}")
    print("\nEndpoint verification: SUCCESS!")
else:
    print("No test pairs found.")
