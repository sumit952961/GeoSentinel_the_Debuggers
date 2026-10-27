import urllib.request
import urllib.parse
import json

def get_req(url):
    req = urllib.request.urlopen(url)
    return json.loads(req.read().decode())

def post_req(url, data):
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read().decode())

print("=" * 75)
print("TESTING MILESTONE 5: PRIORITY ANALYSIS & GRAPH ROUTING ENDPOINTS")
print("=" * 75)

# 1. FastAPI AI Service Health
try:
    h_fastapi = get_req("http://localhost:8000/api/health")
    print(f"  [PASS] FastAPI AI Service (8000): {h_fastapi.get('status')}")
except Exception as e:
    print(f"  [FAIL] FastAPI Health: {e}")

# 2. FastAPI Direct Routing Endpoint
try:
    route_fastapi = post_req("http://localhost:8000/api/routing/route", {
        "scenario_id": 1,
        "origin_lon": -118.685,
        "origin_lat": 34.052,
        "destination_type": "hospital",
        "avoid_blocked": True
    })
    print(f"  [PASS] FastAPI Route to Hospital: Dist={route_fastapi['summary']['distance_km']}km, Time={route_fastapi['summary']['estimated_minutes']}m, Avoided Blocked Roads={len(route_fastapi['summary']['blocked_roads_avoided'])}")
except Exception as e:
    print(f"  [FAIL] FastAPI Route: {e}")

# 3. Spring Boot Backend Health
try:
    h_spring = get_req("http://localhost:8081/api/health")
    print(f"  [PASS] Spring Boot Backend (8081): {h_spring.get('status')}")
except Exception as e:
    print(f"  [FAIL] Spring Boot Health: {e}")

# 4. Spring Boot Priorities Endpoint
try:
    pri_list = get_req("http://localhost:8081/api/priorities?scenarioId=1")
    print(f"  [PASS] GET /api/priorities?scenarioId=1: {len(pri_list)} priority items returned")
    if pri_list:
        p0 = pri_list[0]
        print(f"         Top Priority: Level={p0.get('priorityLevel')}, Score={p0.get('priorityScore')}, BuildingId=#{p0.get('buildingId')}")
        print(f"         Explanation: {p0.get('explanation')[:90]}...")
except Exception as e:
    print(f"  [FAIL] GET /api/priorities: {e}")

# 5. Spring Boot Priorities GeoJSON Endpoint
try:
    pri_geojson = get_req("http://localhost:8081/api/priorities/geojson?scenarioId=1")
    print(f"  [PASS] GET /api/priorities/geojson: {len(pri_geojson.get('features', []))} GeoJSON features (Type: {pri_geojson.get('type')})")
except Exception as e:
    print(f"  [FAIL] GET /api/priorities/geojson: {e}")

# 6. Spring Boot Route Calculation and Persistence Endpoint
try:
    route_spring = post_req("http://localhost:8081/api/routes", {
        "scenarioId": 1,
        "priorityId": 1,
        "originLon": -118.685,
        "originLat": 34.052,
        "destinationType": "hospital",
        "avoidBlocked": True
    })
    print(f"  [PASS] POST /api/routes: Saved Route ID=#{route_spring.get('id')}, Dest='{route_spring.get('destinationName')}', Dist={route_spring.get('distanceKm')}km, CalcTime={route_spring.get('calculationTimeMs')}ms")
    
    # 7. Spring Boot GET /api/routes/{id}/geojson
    route_id = route_spring.get('id')
    route_geo = get_req(f"http://localhost:8081/api/routes/{route_id}/geojson")
    print(f"  [PASS] GET /api/routes/{route_id}/geojson: Geometry Type={route_geo.get('geometry', {}).get('type')}, Coords Points={len(route_geo.get('geometry', {}).get('coordinates', []))}")
except Exception as e:
    print(f"  [FAIL] POST /api/routes: {e}")

print("=" * 75)
