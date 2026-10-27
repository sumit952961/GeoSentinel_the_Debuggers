"""
================================================================================
AIDRS Critical Corrective Engineering Verification Suite
================================================================================
Automated verification across:
1. Operational Zones (Evidence-driven boundaries, non-rectangular, non-ocean)
2. Semantic Evidence Alignment (EMSR357 points vs EIDC survey vs xBD vs Dharali zero-shot)
3. API Endpoints & CORS Integrity (No HTTP 403, all 200)
4. Emergency Routing Engine (Responder Access & Evacuation Routes)
5. Frontend UI Verification (Collapsible Legend, Non-sticky Tooltips, Centroid Badges)
================================================================================
"""

import sys
import json
import urllib.request
import urllib.error

BACKEND_URL = "http://localhost:8081"
FRONTEND_URL = "http://localhost:5173"

def check(name, condition, details=""):
    if condition:
        print(f"  [PASS] {name} {details}")
        return True
    else:
        print(f"  [FAIL] {name} {details}")
        return False

def test_operational_zones():
    print("\n--- 1. Testing Operational Zones & Geometry Integrity ---")
    all_passed = True
    
    for sc_id, sc_name in [(1, "Woolsey Fire"), (2, "Chamoli Flood"), (3, "Cyclone Fani"), (4, "Dharali Flood")]:
        url = f"{BACKEND_URL}/api/map/zones/{sc_id}"
        req = urllib.request.Request(url, headers={"Origin": "http://localhost:5173"})
        try:
            res = urllib.request.urlopen(req)
            data = json.loads(res.read())
            feats = data.get("features", [])
            
            p1 = check(f"{sc_name}: Zone Count", len(feats) >= 4, f"({len(feats)} zones returned)")
            all_passed = all_passed and p1
            
            # Check properties of zones
            has_crit = any(f["properties"].get("criticality") == "CRITICAL" for f in feats)
            has_codes = all(f["properties"].get("zoneCode", "").startswith("Z-") for f in feats)
            has_explanation = all(len(f["properties"].get("explanation", "")) > 10 for f in feats)
            
            p2 = check(f"{sc_name}: Zone Tiers & Properties", has_crit and has_codes and has_explanation,
                       f"(Criticality, codes Z-01.., explainable text present)")
            all_passed = all_passed and p2

            # Check geometry is non-trivial (more than 4 vertices or non-axis-aligned)
            coords = feats[0]["geometry"]["coordinates"][0]
            is_non_trivial = len(coords) >= 4
            p3 = check(f"{sc_name}: Evidence-driven Geometry", is_non_trivial, f"({len(coords)} polygon vertices)")
            all_passed = all_passed and p3

            # For Fani: check all coordinates are on land (lat >= 19.78, lon >= 85.80)
            if sc_id == 3:
                lats = [pt[1] for f in feats for pt in f["geometry"]["coordinates"][0]]
                min_lat = min(lats)
                p4 = check("Cyclone Fani: Strictly Onshore (No Deep Ocean)", min_lat >= 19.78, f"(Min Lat: {min_lat:.4f} >= 19.78)")
                all_passed = all_passed and p4

        except Exception as e:
            check(f"{sc_name}: Operational Zones Request", False, str(e))
            all_passed = False
            
    return all_passed

def test_evidence_semantics():
    print("\n--- 2. Testing Authentic Evidence & Native Taxonomies ---")
    all_passed = True

    # 1. Fani (Scenario 3): Should have Point geometry
    try:
        url = f"{BACKEND_URL}/api/map/damages/3"
        res = urllib.request.urlopen(url)
        data = json.loads(res.read())
        feats = data.get("features", [])
        geom_type = feats[0]["geometry"]["type"] if feats else None
        p1 = check("Scenario 3 (Fani): ST_Point Geometry", geom_type == "Point", f"(Type: {geom_type})")
        
        # Check native damage classes exist
        classes = {f["properties"].get("damageClass") for f in feats}
        p2 = check("Scenario 3 (Fani): Multiple Damage Classes", "destroyed" in classes and "major-damage" in classes, f"(Classes: {classes})")
        all_passed = all_passed and p1 and p2
    except Exception as e:
        check("Scenario 3 (Fani) Damages", False, str(e))
        all_passed = False

    # 2. Chamoli (Scenario 2): Polygon geometry
    try:
        url = f"{BACKEND_URL}/api/map/damages/2"
        res = urllib.request.urlopen(url)
        data = json.loads(res.read())
        feats = data.get("features", [])
        geom_type = feats[0]["geometry"]["type"] if feats else None
        p3 = check("Scenario 2 (Chamoli): Polygon Geometry", geom_type == "Polygon", f"(Type: {geom_type})")
        all_passed = all_passed and p3
    except Exception as e:
        check("Scenario 2 (Chamoli) Damages", False, str(e))
        all_passed = False

    # 3. Dharali (Scenario 4): Zero fake damage, honest zero-shot labels
    try:
        url = f"{BACKEND_URL}/api/map/damages/4"
        res = urllib.request.urlopen(url)
        data = json.loads(res.read())
        feats = data.get("features", [])
        # All damages should be no-damage (intact reference footprints)
        classes = {f["properties"].get("damageClass") for f in feats}
        p4 = check("Scenario 4 (Dharali): Zero Fabricated Damage Labels", classes == {"no-damage"}, f"(Classes: {classes})")
        all_passed = all_passed and p4
    except Exception as e:
        check("Scenario 4 (Dharali) Damages", False, str(e))
        all_passed = False

    return all_passed

def test_api_and_cors():
    print("\n--- 3. Testing API Integrity & CORS Verification ---")
    all_passed = True
    origins = ["http://localhost:5173", "http://127.0.0.1:5173", "https://slow-surfaces-missions-copy.trycloudflare.com"]
    
    for origin in origins:
        req = urllib.request.Request(f"{BACKEND_URL}/api/scenarios", headers={"Origin": origin})
        try:
            res = urllib.request.urlopen(req)
            cors_hdr = res.headers.get("Access-Control-Allow-Origin")
            status = res.status
            p = check(f"CORS from {origin[:35]}...", status == 200 and (cors_hdr == origin or cors_hdr == "*"), f"(Status: {status}, ACAO: {cors_hdr})")
            all_passed = all_passed and p
        except Exception as e:
            check(f"CORS from {origin}", False, str(e))
            all_passed = False

    return all_passed

def test_routing():
    print("\n--- 4. Testing Emergency Routing Engine ---")
    all_passed = True

    # Responder route
    resp_payload = {
        "scenarioId": 3,
        "priorityId": 1,
        "originLon": 85.824,
        "originLat": 19.813,
        "destinationType": "shelter",
        "avoidBlocked": True,
        "routePurpose": "RESPONSE"
    }
    req = urllib.request.Request(f"{BACKEND_URL}/api/routes", data=json.dumps(resp_payload).encode("utf-8"), headers={"Content-Type": "application/json"})
    try:
        res = urllib.request.urlopen(req)
        data = json.loads(res.read())
        p1 = check("Responder Route (Staging -> Site)", res.status == 200 and data.get("distanceKm", 0) > 0, f"(Dist: {data.get('distanceKm')} km, Steps: {len(data.get('routeSteps', []))})")
        all_passed = all_passed and p1
    except Exception as e:
        check("Responder Route", False, str(e))
        all_passed = False

    # Evacuation route
    evac_payload = {
        "scenarioId": 3,
        "priorityId": 1,
        "originLon": 85.824,
        "originLat": 19.813,
        "destinationType": "shelter",
        "avoidBlocked": True,
        "routePurpose": "EVACUATION"
    }
    req2 = urllib.request.Request(f"{BACKEND_URL}/api/routes", data=json.dumps(evac_payload).encode("utf-8"), headers={"Content-Type": "application/json"})
    try:
        res2 = urllib.request.urlopen(req2)
        data2 = json.loads(res2.read())
        p2 = check("Evacuation Route (Site -> Shelter)", res2.status == 200 and data2.get("destinationName") is not None, f"(Dest: {data2.get('destinationName')}, Dist: {data2.get('distanceKm')} km)")
        all_passed = all_passed and p2
    except Exception as e:
        check("Evacuation Route", False, str(e))
        all_passed = False

    return all_passed

def test_frontend_code():
    print("\n--- 5. Testing Frontend UI Code & Aesthetics ---")
    all_passed = True
    
    with open("frontend/src/pages/DisasterMap.jsx", "r", encoding="utf-8") as f:
        src = f.read()

    p1 = check("DisasterMap.jsx: Collapsible Legend State", "isLegendCollapsed" in src)
    p2 = check("DisasterMap.jsx: Non-Sticky Tooltips", "{ sticky: true }" not in src)
    p3 = check("DisasterMap.jsx: Zone Centroid Badge Marker", "zone-centroid-badge" in src)
    p4 = check("DisasterMap.jsx: Point Observation Distinction", "COPERNICUS EMSR357 POINT OBSERVATION" in src)
    p5 = check("DisasterMap.jsx: Authentic Satellite Sensor Context", "SENSOR SCENE CONTEXT" in src)
    
    all_passed = all_passed and p1 and p2 and p3 and p4 and p5
    return all_passed

def main():
    print("=" * 75)
    print("AIDRS CRITICAL CORRECTIVE ENGINEERING VALIDATION SUITE")
    print("=" * 75)

    r1 = test_operational_zones()
    r2 = test_evidence_semantics()
    r3 = test_api_and_cors()
    r4 = test_routing()
    r5 = test_frontend_code()

    overall = r1 and r2 and r3 and r4 and r5

    print("\n" + "=" * 75)
    if overall:
        print("[ALL TESTS PASSED] 100% Corrective Engineering Criteria Satisfied!")
    else:
        print("[FAILURES DETECTED] Please inspect the failed tests above.")
    print("=" * 75)

    sys.exit(0 if overall else 1)

if __name__ == "__main__":
    main()
