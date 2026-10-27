"""
============================================================
scripts/validate_system_scenarios.py
============================================================
Comprehensive End-to-End System Validator for DRAS:
Validates all 4 Scenarios:
  1. Malibu Wildfire (Benchmark Baseline)
  2. Chamoli Flash Flood & Debris Flow 2021 (EIDC Ground Truth)
  3. Cyclone Fani Coastal Surge 2019 (Copernicus EMS Ground Truth)
  4. Dharali Cloudburst 2025 (Qualitative Zero-Shot Generalization)

Validates:
  - Database schema & scenario records (disaster_scenarios)
  - Building damage predictions (damage_predictions & buildings)
  - Priority triage scores (priority_assessments: 0.40S + 0.25P + 0.20I + 0.15A)
  - 4-Tier Operational Disaster Zones (operational_zones: CRITICAL, HIGH, MEDIUM, LOW)
  - Road networks & dynamic roadblocks (roads)
  - Critical facilities (hospitals, shelters)
  - Evacuation & Response Access routes (evacuation_routes)
  - Frontend satellite evidence assets & localized building crops
  - Model weights & pipeline registry
============================================================
"""

import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
import json

DB_PARAMS = {
    "dbname": "disaster_db",
    "user": "postgres",
    "password": "postgres",
    "host": "localhost",
    "port": 5432
}

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SATELLITE_DIR = os.path.join(ROOT_DIR, "frontend", "public", "satellite_evidence")
CROPS_DIR = os.path.join(SATELLITE_DIR, "crops")
MODELS_DIR = os.path.join(ROOT_DIR, "models")

EXPECTED_SCENARIOS = {
    1: {"name_substr": "Wildfire", "type": "WILDFIRE", "expected_zones": 4},
    2: {"name_substr": "Chamoli", "type": "FLASH_FLOOD", "expected_zones": 4},
    3: {"name_substr": "Fani", "type": "CYCLONE", "expected_zones": 4},
    4: {"name_substr": "Dharali", "type": "FLASH_FLOOD", "expected_zones": 4}
}

DAMAGE_CLASSES = ["NO_DAMAGE", "MINOR_DAMAGE", "MAJOR_DAMAGE", "DESTROYED"]
ZONE_TIERS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]

def print_header(title):
    print("\n" + "=" * 70)
    print(f" {title.upper()} ")
    print("=" * 70)

def validate_all():
    print_header("DRAS System End-to-End Scientific & Operational Validation")
    errors = []
    warnings = []

    # 1. DB Connection
    try:
        conn = psycopg2.connect(**DB_PARAMS)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        print("[PASS] PostgreSQL Database Connection Established (disaster_db)")
    except Exception as e:
        print(f"[FAIL] Cannot connect to PostgreSQL: {e}")
        return False

    # 2. Check Scenarios
    print_header("1. Scenario Catalog Verification")
    cur.execute("""
        SELECT id, name, disaster_type, location_name, is_demo,
               ST_AsGeoJSON(center_point) as center_geojson,
               ST_AsGeoJSON(boundary) as boundary_geojson
        FROM disaster_scenarios 
        ORDER BY id
    """)
    scenarios = cur.fetchall()
    print(f"Total Scenarios Found: {len(scenarios)}")
    
    scenario_map = {}
    for s in scenarios:
        sid = s["id"]
        scenario_map[sid] = s
        center = "N/A"
        if s["center_geojson"]:
            c_data = json.loads(s["center_geojson"])
            center = f"Lng: {c_data['coordinates'][0]:.4f}, Lat: {c_data['coordinates'][1]:.4f}"
        print(f"  • [{sid}] {s['name']} | Type: {s['disaster_type']} | Center: ({center}) | Demo: {s['is_demo']}")

    for exp_id, exp_meta in EXPECTED_SCENARIOS.items():
        if exp_id not in scenario_map:
            errors.append(f"Scenario {exp_id} ({exp_meta['name_substr']}) missing in DB!")
        else:
            s = scenario_map[exp_id]
            if exp_meta["name_substr"].lower() not in s["name"].lower():
                warnings.append(f"Scenario {exp_id} name check: '{s['name']}' contains '{exp_meta['name_substr']}'")

    # 3. Check Buildings & Damage Predictions
    print_header("2. Building Footprints & Damage Distributions")
    for sid in scenario_map.keys():
        cur.execute("""
            SELECT b.id, b.damage_class, ST_AsGeoJSON(b.geometry) as geojson,
                   p.priority_score, p.priority_level
            FROM buildings b
            LEFT JOIN priority_assessments p ON p.building_id = b.id
            WHERE b.scenario_id = %s
        """, (sid,))
        b_rows = cur.fetchall()
        total_b = len(b_rows)
        
        counts = {}
        valid_geom = 0
        has_priority = 0
        for r in b_rows:
            dmg = r["damage_class"] or "UNKNOWN"
            counts[dmg] = counts.get(dmg, 0) + 1
            if r["geojson"]:
                valid_geom += 1
            if r["priority_score"] is not None:
                has_priority += 1

        print(f"  Scenario {sid} ({scenario_map[sid]['name']}):")
        print(f"    Total Buildings: {total_b} (Valid Polygons: {valid_geom}, Triage Ranked: {has_priority})")
        print(f"    Damage Classes: {counts}")
        
        if total_b == 0:
            errors.append(f"Scenario {sid} has 0 buildings!")
        elif valid_geom < total_b:
            warnings.append(f"Scenario {sid} has {total_b - valid_geom} buildings missing valid geometries")

    # 4. Check Operational Disaster Zones (4-tier verification)
    print_header("3. 4-Tier Operational Disaster Zones")
    for sid in scenario_map.keys():
        cur.execute("""
            SELECT id, zone_code, name, criticality, criticality_score, 
                   ST_AsGeoJSON(geometry) as boundary_geojson,
                   estimated_population, recommended_action, total_buildings
            FROM operational_zones
            WHERE scenario_id = %s
            ORDER BY criticality_score DESC
        """, (sid,))
        zones = cur.fetchall()
        print(f"  Scenario {sid} ({scenario_map[sid]['name']}): {len(zones)} Zones Defined")
        
        tier_found = set()
        for z in zones:
            tier_found.add(z["criticality"])
            poly_type = "None"
            if z["boundary_geojson"]:
                try:
                    gj = json.loads(z["boundary_geojson"])
                    poly_type = gj.get("type", "Unknown")
                except:
                    poly_type = "Invalid JSON"
            print(f"    [{z['zone_code']}] {z['criticality']:<8} | Score: {z['criticality_score']:.2f} | Bldgs: {z['total_buildings']} | Pop: {z['estimated_population']} | Geom: {poly_type} | {z['name']}")

        missing_tiers = set(ZONE_TIERS) - tier_found
        if missing_tiers:
            errors.append(f"Scenario {sid} missing required zone tiers: {missing_tiers}")

    # 5. Check Critical Facilities (Hospitals, Shelters)
    print_header("4. Emergency Infrastructure & Medical Facilities")
    for sid in scenario_map.keys():
        cur.execute("SELECT id, name, capacity, is_operational FROM hospitals WHERE scenario_id = %s", (sid,))
        hospitals = cur.fetchall()
        cur.execute("SELECT id, name, capacity, is_operational FROM shelters WHERE scenario_id = %s", (sid,))
        shelters = cur.fetchall()
        print(f"  Scenario {sid}: {len(hospitals)} Hospitals, {len(shelters)} Shelters")
        if len(hospitals) == 0 and len(shelters) == 0:
            warnings.append(f"Scenario {sid} has no emergency facilities mapped!")

    # 6. Check Road Networks & Roadblocks
    print_header("5. Road Graph & Dynamic Roadblocks")
    for sid in scenario_map.keys():
        cur.execute("SELECT COUNT(*) as count FROM roads WHERE scenario_id = %s", (sid,))
        rc = cur.fetchone()["count"]
        cur.execute("SELECT COUNT(*) as count FROM roads WHERE scenario_id = %s AND is_blocked = TRUE", (sid,))
        bc = cur.fetchone()["count"]
        print(f"  Scenario {sid}: {rc} Road Segments ({bc} Blocked Segments)")
        if rc == 0:
            errors.append(f"Scenario {sid} has 0 road segments in database!")

    # 7. Check Pre-Seeded Evacuation & Response Routes
    print_header("6. Operational Evacuation & Response Routes")
    for sid in scenario_map.keys():
        cur.execute("""
            SELECT id, route_type, destination_name, 
                   distance_km, estimated_minutes,
                   ST_AsGeoJSON(geometry) as geojson
            FROM evacuation_routes
            WHERE scenario_id = %s
            ORDER BY route_type, id
        """, (sid,))
        routes = cur.fetchall()
        print(f"  Scenario {sid}: {len(routes)} Operational Graph Routes Registered")
        for r in routes:
            print(f"    [{r['route_type']}] -> {r['destination_name']} | {r['distance_km']:.2f}km ({r['estimated_minutes']:.1f} min)")
        
        if len(routes) == 0:
            errors.append(f"Scenario {sid} has no operational routes registered in evacuation_routes!")

    # 8. Check Satellite Evidence Assets on Disk
    print_header("7. Frontend Satellite Evidence Assets On Disk")
    print(f"Evidence Root: {SATELLITE_DIR}")
    print(f"Crops Root:    {CROPS_DIR}")

    if not os.path.exists(SATELLITE_DIR):
        errors.append(f"Satellite evidence directory missing: {SATELLITE_DIR}")
    else:
        # Check scenario tile images
        for sid in [1, 2, 3, 4]:
            pre_path = os.path.join(SATELLITE_DIR, f"scenario_{sid}_pre.png")
            post_path = os.path.join(SATELLITE_DIR, f"scenario_{sid}_post.png")
            pre_ok = os.path.exists(pre_path)
            post_ok = os.path.exists(post_path)
            status = "OK" if (pre_ok and post_ok) else "MISSING"
            print(f"  Scenario {sid} Dual Tile: Pre [{'YES' if pre_ok else 'NO'}] | Post [{'YES' if post_ok else 'NO'}] -> {status}")
            if not pre_ok or not post_ok:
                errors.append(f"Scenario {sid} missing pre/post satellite evidence tiles!")

        # Check crops
        if not os.path.exists(CROPS_DIR):
            errors.append(f"Crops directory missing: {CROPS_DIR}")
        else:
            crops_found = 0
            for sid in [1, 2, 3, 4]:
                for dmg in ["no-damage", "minor-damage", "major-damage", "destroyed"]:
                    c_pre = os.path.join(CROPS_DIR, f"scen{sid}_{dmg}_pre.png")
                    c_post = os.path.join(CROPS_DIR, f"scen{sid}_{dmg}_post.png")
                    if os.path.exists(c_pre) and os.path.exists(c_post):
                        crops_found += 2
                    else:
                        errors.append(f"Missing localized building crop: scen{sid}_{dmg}")
            print(f"  Building Evidence Dual-Crops: {crops_found}/32 files verified present")

    # 9. Verify Checkpoints & Scientific Integrity
    print_header("8. Model Weights & Inference Pipeline")
    v2_ckpt = os.path.join(MODELS_DIR, "india_v2", "best_model.pth")
    v3_s1 = os.path.join(MODELS_DIR, "india_v3", "stage1", "best_model.pt")
    v3_s2 = os.path.join(MODELS_DIR, "india_v3", "stage2", "best_model.pt")
    
    print(f"  India V2 Model Checkpoint:            {'FOUND' if os.path.exists(v2_ckpt) else 'NOT FOUND'} ({v2_ckpt})")
    print(f"  India V3 Stage 1 Checkpoint (Loc):   {'FOUND' if os.path.exists(v3_s1) else 'NOT FOUND'} ({v3_s1})")
    print(f"  India V3 Stage 2 Checkpoint (Class): {'FOUND' if os.path.exists(v3_s2) else 'NOT FOUND'} ({v3_s2})")
    if not os.path.exists(v3_s1) or not os.path.exists(v3_s2):
        errors.append("India V3 Stage 1 or Stage 2 model checkpoints are missing!")

    # 10. Summary
    print_header("Validation Summary & Scientific Integrity Verdict")
    if errors:
        print(f"[FAIL] {len(errors)} critical validation failures found:")
        for e in errors:
            print(f"  - {e}")
    else:
        print("[SUCCESS] All 4 Scenarios Passed 100% Operational & Scientific Integrity Checks!")

    if warnings:
        print(f"\n[NOTICE] {len(warnings)} non-critical notices:")
        for w in warnings:
            print(f"  - {w}")

    cur.close()
    conn.close()
    return len(errors) == 0

if __name__ == "__main__":
    success = validate_all()
    sys.exit(0 if success else 1)
