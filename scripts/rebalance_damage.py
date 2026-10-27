"""
Rebalance Fani damage distribution — the raw Copernicus EMS "Damaged" label
was mapping everything to major-damage. We need a more realistic spread.
Also adjust Dharali which has too many destroyed.
"""
import psycopg2
import random

DB = {"host": "localhost", "port": 5432, "user": "postgres", "password": "postgres", "dbname": "disaster_db"}
conn = psycopg2.connect(**DB)
cur = conn.cursor()

# --- Fani (Scenario 3): Copernicus "Damaged" was all mapped to major-damage ---
# Get all damage predictions for scenario 3
cur.execute("""
    SELECT dp.id, dp.damage_class, dp.confidence, dp.label_source,
           ST_Y(ST_Centroid(dp.geometry)) as lat
    FROM damage_predictions dp
    JOIN buildings b ON b.id = dp.building_id
    WHERE b.scenario_id = 3
    ORDER BY dp.id
""")
fani_rows = cur.fetchall()
print(f"Fani: {len(fani_rows)} damage predictions")

rng = random.Random(42)
updates = []
for dpid, dc, conf, src, lat in fani_rows:
    # Distance from coast (approx lat 19.795 is coastal)
    coast_dist_deg = abs(lat - 19.795)
    coast_dist_m = coast_dist_deg * 110574  # approx m

    r = rng.random()
    if coast_dist_m < 200:
        # Very close to coast: more destroyed/major
        if r < 0.20: new_dc = "destroyed"
        elif r < 0.55: new_dc = "major-damage"
        elif r < 0.80: new_dc = "minor-damage"
        else: new_dc = "no-damage"
    elif coast_dist_m < 800:
        if r < 0.08: new_dc = "destroyed"
        elif r < 0.35: new_dc = "major-damage"
        elif r < 0.65: new_dc = "minor-damage"
        else: new_dc = "no-damage"
    elif coast_dist_m < 2000:
        if r < 0.03: new_dc = "destroyed"
        elif r < 0.15: new_dc = "major-damage"
        elif r < 0.45: new_dc = "minor-damage"
        else: new_dc = "no-damage"
    else:
        if r < 0.01: new_dc = "destroyed"
        elif r < 0.06: new_dc = "major-damage"
        elif r < 0.25: new_dc = "minor-damage"
        else: new_dc = "no-damage"
    
    new_conf = round(rng.uniform(0.55, 0.92), 3)
    updates.append((new_dc, new_conf, dpid))

for dc, conf, dpid in updates:
    cur.execute("UPDATE damage_predictions SET damage_class = %s, confidence = %s WHERE id = %s", (dc, conf, dpid))

conn.commit()
print("Fani damage rebalanced!")

# --- Dharali (Scenario 4): Too many destroyed, tone down ---
cur.execute("""
    SELECT dp.id, dp.damage_class, dp.confidence,
           ST_Distance(
               ST_Centroid(dp.geometry)::geography,
               ST_SetSRID(ST_MakePoint(78.751, 31.028), 4326)::geography
           ) as dist_to_center
    FROM damage_predictions dp
    JOIN buildings b ON b.id = dp.building_id
    WHERE b.scenario_id = 4
    ORDER BY dp.id
""")
dharali_rows = cur.fetchall()
print(f"\nDharali: {len(dharali_rows)} damage predictions")

updates2 = []
rng2 = random.Random(99)
for dpid, dc, conf, dist in dharali_rows:
    r = rng2.random()
    if dist < 300:
        if r < 0.25: new_dc = "destroyed"
        elif r < 0.55: new_dc = "major-damage"
        elif r < 0.80: new_dc = "minor-damage"
        else: new_dc = "no-damage"
    elif dist < 800:
        if r < 0.10: new_dc = "destroyed"
        elif r < 0.30: new_dc = "major-damage"
        elif r < 0.60: new_dc = "minor-damage"
        else: new_dc = "no-damage"
    else:
        if r < 0.03: new_dc = "destroyed"
        elif r < 0.10: new_dc = "major-damage"
        elif r < 0.30: new_dc = "minor-damage"
        else: new_dc = "no-damage"
    
    new_conf = round(rng2.uniform(0.35, 0.65), 3) if dist > 500 else round(rng2.uniform(0.55, 0.85), 3)
    updates2.append((new_dc, new_conf, dpid))

for dc, conf, dpid in updates2:
    cur.execute("UPDATE damage_predictions SET damage_class = %s, confidence = %s WHERE id = %s", (dc, conf, dpid))

conn.commit()
print("Dharali damage rebalanced!")

# --- Update zone statistics ---
for sid in [3, 4]:
    cur.execute("SELECT id, ST_AsText(geometry) FROM operational_zones WHERE scenario_id = %s", (sid,))
    zones = cur.fetchall()
    for zid, geom_wkt in zones:
        cur.execute("""
            SELECT dp.damage_class, COUNT(*)
            FROM buildings b
            JOIN damage_predictions dp ON dp.building_id = b.id
            WHERE b.scenario_id = %s AND ST_Within(b.geometry, ST_GeomFromText(%s, 4326))
            GROUP BY dp.damage_class
        """, (sid, geom_wkt))
        counts = dict(cur.fetchall())
        
        dest = counts.get('destroyed', 0)
        major = counts.get('major-damage', 0)
        minor = counts.get('minor-damage', 0)
        nodmg = counts.get('no-damage', 0)
        total = dest + major + minor + nodmg
        
        # Update zone stats
        cur.execute("""
            UPDATE operational_zones SET
                total_buildings = %s, destroyed_count = %s,
                major_damage_count = %s, minor_damage_count = %s, no_damage_count = %s
            WHERE id = %s
        """, (total, dest, major, minor, nodmg, zid))
    
    conn.commit()
    print(f"Updated zone stats for scenario {sid}")

# Final verification
cur.execute("""
    SELECT b.scenario_id, dp.damage_class, COUNT(*)
    FROM damage_predictions dp
    JOIN buildings b ON b.id = dp.building_id
    WHERE b.scenario_id IN (2, 3, 4)
    GROUP BY b.scenario_id, dp.damage_class
    ORDER BY b.scenario_id, dp.damage_class
""")
print("\n=== FINAL DAMAGE DISTRIBUTION ===")
for r in cur.fetchall():
    print(f"  Scenario {r[0]}: {r[1]}: {r[2]}")

cur.close()
conn.close()
