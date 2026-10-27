"""
Run fix_building_data for Fani and Dharali only (Chamoli already done).
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from fix_building_data import (
    SCENARIOS, DB_PARAMS, fetch_osm_buildings, assign_damage_copernicus,
    assign_damage_distance_model, seed_buildings_to_db, create_spatial_zones,
    generate_fallback_buildings, haversine_m
)
import psycopg2
import random

conn = psycopg2.connect(**DB_PARAMS)
conn.autocommit = False
cur = conn.cursor()

# Only process Fani and Dharali
for key in ['fani', 'dharali']:
    config = SCENARIOS[key]
    scenario_id = config['id']
    print(f"\n{'='*60}")
    print(f"Processing: {config['name']} (Scenario {scenario_id})")
    print(f"{'='*60}")
    
    buildings = fetch_osm_buildings(config['osm_bbox'], key)
    
    if not buildings:
        print(f"  No OSM buildings found, using fallback generator")
        buildings = generate_fallback_buildings(config, key)
    
    max_buildings = 300
    if len(buildings) > max_buildings:
        cx = (config['osm_bbox'][0] + config['osm_bbox'][2]) / 2
        cy = (config['osm_bbox'][1] + config['osm_bbox'][3]) / 2
        buildings.sort(key=lambda b: haversine_m(b['centroid_lon'], b['centroid_lat'], cx, cy))
        buildings = buildings[:max_buildings]
        print(f"  Capped to {max_buildings} buildings")
    
    rng = random.Random(scenario_id * 42)
    
    if config['damage_model'] == 'copernicus_match':
        # Fix: resolve path correctly
        copernicus_file = config['copernicus_data']
        print(f"  Copernicus file: {copernicus_file}")
        print(f"  File exists: {os.path.exists(copernicus_file)}")
        buildings = assign_damage_copernicus(buildings, copernicus_file, rng)
    elif config['damage_model'] == 'distance_from_hazard':
        hazard_wkt = config.get('hazard_corridor_wkt') or config.get('hazard_fan_wkt')
        buildings = assign_damage_distance_model(buildings, hazard_wkt, rng)
    
    count = seed_buildings_to_db(buildings, scenario_id, config['label_source'], cur)
    create_spatial_zones(buildings, config, cur, scenario_id)
    conn.commit()
    print(f"  COMMITTED: {count} buildings for {config['name']}")

# Verification
print("\n" + "="*60)
print("VERIFICATION")
print("="*60)
cur.execute("""
    SELECT scenario_id, COUNT(*), 
        ROUND(MIN(ST_Area(geometry::geography))::numeric, 1),
        ROUND(AVG(ST_Area(geometry::geography))::numeric, 1),
        ROUND(MAX(ST_Area(geometry::geography))::numeric, 1),
        MIN(ST_NPoints(geometry)),
        ROUND(AVG(ST_NPoints(geometry))::numeric, 1),
        MAX(ST_NPoints(geometry))
    FROM buildings 
    WHERE scenario_id IN (2, 3, 4)
    GROUP BY scenario_id ORDER BY scenario_id
""")
print(f"\n{'SID':<5} {'Count':<8} {'Min m²':<10} {'Avg m²':<10} {'Max m²':<10} {'Min pts':<8} {'Avg pts':<8} {'Max pts':<8}")
print("-" * 72)
for r in cur.fetchall():
    print(f"{r[0]:<5} {r[1]:<8} {r[2]:<10} {r[3]:<10} {r[4]:<10} {r[5]:<8} {r[6]:<8} {r[7]:<8}")

cur.execute("""
    SELECT b.scenario_id, dp.damage_class, COUNT(*)
    FROM damage_predictions dp
    JOIN buildings b ON b.id = dp.building_id
    WHERE b.scenario_id IN (2, 3, 4)
    GROUP BY b.scenario_id, dp.damage_class
    ORDER BY b.scenario_id, dp.damage_class
""")
print(f"\nDamage Distribution:")
for r in cur.fetchall():
    print(f"  Scenario {r[0]}: {r[1]}: {r[2]}")

cur.close()
conn.close()
print("\nDone!")
