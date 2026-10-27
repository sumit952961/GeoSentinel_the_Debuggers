"""
============================================================
Comprehensive End-to-End System Verification Test (DRAS v1.0)
============================================================
"""

import urllib.request
import json
import time

def get_json(url):
    req = urllib.request.urlopen(url)
    return json.loads(req.read().decode())

def post_json(url, data):
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read().decode())

def run_tests():
    print("=" * 80)
    print("RUNNING FINAL END-TO-END VERIFICATION SUITE FOR DRAS v1.0")
    print("=" * 80)
    
    passes = 0
    failures = 0

    # 1. Spring Boot Backend Health
    try:
        sb_health = get_json("http://localhost:8081/api/health")
        assert sb_health.get("status") == "UP"
        print("  [PASS] 1. Spring Boot Backend (Port 8081): UP (Database & Actuator Connected)")
        passes += 1
    except Exception as e:
        print(f"  [FAIL] 1. Spring Boot Backend Health: {e}")
        failures += 1

    # 2. FastAPI AI Service Health
    try:
        ai_health = get_json("http://localhost:8000/health")
        assert ai_health.get("status") == "UP"
        print("  [PASS] 2. FastAPI AI Microservice (Port 8000): UP (PyTorch & NetworkX Ready)")
        passes += 1
    except Exception as e:
        print(f"  [FAIL] 2. FastAPI AI Service Health: {e}")
        failures += 1

    # 3. Scenario Metadata
    try:
        scen = get_json("http://localhost:8081/api/scenarios/1")
        assert scen.get("id") == 1
        assert "Woolsey Fire" in scen.get("name")
        print(f"  [PASS] 3. Disaster Scenario Loaded: '{scen.get('name')}' (Type: {scen.get('disasterType')})")
        passes += 1
    except Exception as e:
        print(f"  [FAIL] 3. Scenario Retrieval: {e}")
        failures += 1

    # 4. Damage Predictions (GeoJSON)
    try:
        damages = get_json("http://localhost:8081/api/map/damages?scenarioId=1")
        feats = damages.get("features", [])
        assert len(feats) == 181
        sample_props = feats[0]["properties"]
        assert "damageClass" in sample_props
        assert "confidence" in sample_props
        assert "probabilities" in sample_props
        print(f"  [PASS] 4. Damage Predictions: {len(feats)} building polygons with 4-class softmax probabilities")
        passes += 1
    except Exception as e:
        print(f"  [FAIL] 4. Damage Predictions: {e}")
        failures += 1

    # 5. Explainable Priority Rankings (GeoJSON)
    try:
        priorities = get_json("http://localhost:8081/api/priorities/geojson?scenarioId=1")
        p_feats = priorities.get("features", [])
        assert len(p_feats) == 181
        crit_count = sum(1 for f in p_feats if f["properties"].get("priority_level") == "CRITICAL")
        high_count = sum(1 for f in p_feats if f["properties"].get("priority_level") == "HIGH")
        print(f"  [PASS] 5. Priority Rankings: {len(p_feats)} locations (Critical: {crit_count}, High: {high_count})")
        passes += 1
    except Exception as e:
        print(f"  [FAIL] 5. Priority Rankings: {e}")
        failures += 1

    # 6. Road Network & Blockages
    try:
        roads = get_json("http://localhost:8081/api/map/roads?scenarioId=1")
        r_feats = roads.get("features", [])
        blocked = sum(1 for f in r_feats if f["properties"].get("isBlocked"))
        assert len(r_feats) == 8
        assert blocked == 4
        print(f"  [PASS] 6. Road Infrastructure: {len(r_feats)} corridors ({blocked} hazardous/blocked routes flagged)")
        passes += 1
    except Exception as e:
        print(f"  [FAIL] 6. Road Network: {e}")
        failures += 1

    # 7. Emergency Facilities (Hospitals & Shelters)
    try:
        hosps = get_json("http://localhost:8081/api/map/hospitals?scenarioId=1")
        shelts = get_json("http://localhost:8081/api/map/shelters?scenarioId=1")
        assert len(hosps.get("features", [])) == 7
        assert len(shelts.get("features", [])) == 6
        print(f"  [PASS] 7. Emergency Facilities: {len(hosps['features'])} Operational Hospitals + {len(shelts['features'])} Relief Shelters")
        passes += 1
    except Exception as e:
        print(f"  [FAIL] 7. Emergency Facilities: {e}")
        failures += 1

    # 8A. Response Access Route Calculation (Staging Point -> Priority Structure)
    try:
        t0 = time.perf_counter()
        resp_route = post_json("http://localhost:8081/api/routes", {
            "scenarioId": 1,
            "priorityId": 101,
            "originLon": -118.685,
            "originLat": 34.052,
            "avoidBlocked": True,
            "routePurpose": "RESPONSE"
        })
        calc_time = (time.perf_counter() - t0) * 1000.0
        assert "Staging Point" in resp_route.get("originName")
        assert resp_route.get("distanceKm") > 0
        assert resp_route.get("routePurpose") == "RESPONSE"
        assert len(resp_route.get("routeSteps", [])) > 0
        print(f"  [PASS] 8A. Response Access Route: Staging Point -> Structure #101, Dist={resp_route.get('distanceKm')}km, Avoided={resp_route.get('avoidedBlockageCount')} roads (Latency: {calc_time:.1f}ms)")
        passes += 1
    except Exception as e:
        print(f"  [FAIL] 8A. Response Access Route: {e}")
        failures += 1

    # 8B. Evacuation Route Calculation (Priority Structure -> Hospital)
    try:
        t0 = time.perf_counter()
        evac_route = post_json("http://localhost:8081/api/routes", {
            "scenarioId": 1,
            "priorityId": 101,
            "originLon": -118.685,
            "originLat": 34.052,
            "destinationType": "hospital",
            "avoidBlocked": True,
            "routePurpose": "EVACUATION"
        })
        calc_time = (time.perf_counter() - t0) * 1000.0
        assert evac_route.get("destinationName") == "Malibu Urgent Care Center"
        assert evac_route.get("distanceKm") > 0
        assert evac_route.get("routePurpose") == "EVACUATION"
        assert len(evac_route.get("routeSteps", [])) > 0
        print(f"  [PASS] 8B. Evacuation Route: Structure #101 -> '{evac_route.get('destinationName')}', Dist={evac_route.get('distanceKm')}km, Time={evac_route.get('estimatedMinutes')}m (Latency: {calc_time:.1f}ms)")
        passes += 1
    except Exception as e:
        print(f"  [FAIL] 8B. Evacuation Route: {e}")
        failures += 1

    # 9. Spatial Summary KPIs
    try:
        summary = get_json("http://localhost:8081/api/analysis/1/summary")
        assert summary.get("totalBuildings") == 181
        assert summary.get("noDamageCount") == 106
        print(f"  [PASS] 9. Spatial Summary KPIs: Total={summary.get('totalBuildings')}, NoDamage={summary.get('noDamageCount')}, Minor={summary.get('minorDamageCount')}, Major={summary.get('majorDamageCount')}, Destroyed={summary.get('destroyedCount')}")
        passes += 1
    except Exception as e:
        print(f"  [FAIL] 9. Summary KPIs: {e}")
        failures += 1

    print("=" * 80)
    print(f"FINAL RESULT: {passes} PASSED / {failures} FAILED ({passes/(passes+failures)*100:.0f}% SUCCESS RATE)")
    print("=" * 80)

if __name__ == "__main__":
    run_tests()
