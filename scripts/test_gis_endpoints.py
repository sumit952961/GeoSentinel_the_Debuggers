import urllib.request
import json

def test_ep(name, url):
    try:
        req = urllib.request.urlopen(url)
        data = json.loads(req.read().decode())
        if isinstance(data, dict) and "features" in data:
            print(f"  [PASS] {name.ljust(35)}: {len(data['features'])} features (GeoJSON: {data.get('type')})")
            if len(data['features']) > 0:
                sample_props = data['features'][0].get('properties', {})
                print(f"         Sample properties: {sample_props}")
        elif isinstance(data, list):
            print(f"  [PASS] {name.ljust(35)}: {len(data)} items returned")
        else:
            print(f"  [PASS] {name.ljust(35)}: {data}")
    except Exception as e:
        print(f"  [FAIL] {name.ljust(35)}: {e}")

print("=" * 75)
print("TESTING SPRING BOOT GIS & SPATIAL DASHBOARD REST ENDPOINTS (Port 8081)")
print("=" * 75)

test_ep("GET /api/scenarios", "http://localhost:8081/api/scenarios")
test_ep("GET /api/scenarios/1", "http://localhost:8081/api/scenarios/1")
test_ep("GET /api/map/damages?scenarioId=1", "http://localhost:8081/api/map/damages?scenarioId=1")
test_ep("GET /api/map/buildings?scenarioId=1", "http://localhost:8081/api/map/buildings?scenarioId=1")
test_ep("GET /api/map/roads?scenarioId=1", "http://localhost:8081/api/map/roads?scenarioId=1")
test_ep("GET /api/map/hospitals?scenarioId=1", "http://localhost:8081/api/map/hospitals?scenarioId=1")
test_ep("GET /api/map/shelters?scenarioId=1", "http://localhost:8081/api/map/shelters?scenarioId=1")
test_ep("GET /api/analysis/1/summary", "http://localhost:8081/api/analysis/1/summary")
print("=" * 75)
