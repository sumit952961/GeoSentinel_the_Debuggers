"""
Fix Scenario 1 (Woolsey Fire) operational zones so they are proper spatial sectors
with realistic mixed damage and accurate statistics, consistent with Scenarios 2, 3, 4.
"""
import psycopg2

DB = {"host": "localhost", "port": 5432, "user": "postgres", "password": "postgres", "dbname": "disaster_db"}
conn = psycopg2.connect(**DB)
cur = conn.cursor()

# Get all buildings for scenario 1
cur.execute("""
    SELECT b.id, ST_X(ST_Centroid(b.geometry)) as lon, ST_Y(ST_Centroid(b.geometry)) as lat,
           dp.damage_class, pa.priority_score
    FROM buildings b
    JOIN damage_predictions dp ON dp.building_id = b.id
    LEFT JOIN priority_assessments pa ON pa.building_id = b.id
    WHERE b.scenario_id = 1
""")
rows = cur.fetchall()
print(f"Scenario 1: {len(rows)} buildings")

lons = [r[1] for r in rows]
lats = [r[2] for r in rows]
min_lon, max_lon = min(lons), max(lons)
min_lat, max_lat = min(lats), max(lats)
mid_lon = (min_lon + max_lon) / 2
mid_lat = (min_lat + max_lat) / 2
pad = 0.003

quadrants = [
    (min_lon - pad, min_lat - pad, mid_lon, mid_lat),      # SW - Malibu Canyon / Coast
    (mid_lon, min_lat - pad, max_lon + pad, mid_lat),      # SE - Point Dume
    (min_lon - pad, mid_lat, mid_lon, max_lat + pad),      # NW - Kanan Valley
    (mid_lon, mid_lat, max_lon + pad, max_lat + pad),      # NE - Westlake Staging
]

zone_defs = [
    {"code": "ZONE-SCEN01-01", "name": "Malibu Canyon Ground Zero Sector", "crit": "CRITICAL", "score": 0.88,
     "recom": "Immediate USAR search and rescue in active burn footprint. Air assets for thermal monitoring."},
    {"code": "ZONE-SCEN01-02", "name": "Point Dume Severe Impact Sector", "crit": "HIGH", "score": 0.65,
     "recom": "Structural triage and residential hazard perimeter control. Evacuate vulnerable residents."},
    {"code": "ZONE-SCEN01-03", "name": "Kanan Valley Buffer Sector", "crit": "MEDIUM", "score": 0.42,
     "recom": "Utility stabilization and airborne ember containment. Clear secondary roadways."},
    {"code": "ZONE-SCEN01-04", "name": "Westlake Staging & Evacuation Base", "crit": "LOW", "score": 0.18,
     "recom": "Establish multi-agency logistics staging hub, mobile medical station, and civil evacuation center."}
]

quad_stats = []
for i, (qw, qs, qe, qn) in enumerate(quadrants):
    dest = maj = minr = nodmg = 0
    bldg_ids = []
    pri_scores = []
    for bid, bx, by, dc, pri in rows:
        if qw <= bx <= qe and qs <= by <= qn:
            if dc == 'destroyed': dest += 1
            elif dc == 'major-damage': maj += 1
            elif dc == 'minor-damage': minr += 1
            else: nodmg += 1
            bldg_ids.append(bid)
            if pri is not None: pri_scores.append(float(pri))
    total = dest + maj + minr + nodmg
    sev = dest * 4 + maj * 3 + minr * 2 + nodmg * 1
    avg_sev = sev / max(total, 1)
    quad_stats.append({
        "qi": i, "total": total, "dest": dest, "maj": maj, "min": minr, "nodmg": nodmg,
        "avg_sev": avg_sev, "bldg_ids": bldg_ids,
        "avg_pri": sum(pri_scores) / max(len(pri_scores), 1) if pri_scores else 0.3
    })

# Sort by severity descending
quad_stats.sort(key=lambda x: x["avg_sev"], reverse=True)

# Delete and recreate scenario 1 zones
cur.execute("DELETE FROM operational_zones WHERE scenario_id = 1")

for rank, qs in enumerate(quad_stats):
    zdef = zone_defs[rank]
    qw, qsouth, qe, qn = quadrants[qs["qi"]]
    wkt = f"POLYGON(({qw} {qsouth}, {qe} {qsouth}, {qe} {qn}, {qw} {qn}, {qw} {qsouth}))"
    explanation = (
        f"{qs['total']} buildings assessed: {qs['dest']} destroyed, {qs['maj']} major damage, "
        f"{qs['min']} minor damage, {qs['nodmg']} no damage. Mean severity: {qs['avg_sev']:.2f}/4.00"
    )
    est_pop = qs["total"] * 4
    
    cur.execute("""
        INSERT INTO operational_zones (
            scenario_id, zone_code, name, criticality, criticality_score,
            total_buildings, destroyed_count, major_damage_count, minor_damage_count, no_damage_count,
            estimated_population, avg_priority_score, recommended_action, explanation,
            constituent_building_ids, geometry, created_at
        ) VALUES (
            1, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, ST_SetSRID(ST_GeomFromText(%s), 4326), NOW()
        )
    """, (
        zdef["code"], zdef["name"], zdef["crit"], zdef["score"],
        qs["total"], qs["dest"], qs["maj"], qs["min"], qs["nodmg"],
        est_pop, round(qs["avg_pri"], 3), zdef["recom"], explanation,
        ','.join(map(str, qs["bldg_ids"][:50])), wkt
    ))

conn.commit()
print("Scenario 1 operational zones updated successfully!")

# Verify all zones
cur.execute("""
    SELECT scenario_id, name, criticality, total_buildings, destroyed_count, major_damage_count, minor_damage_count, no_damage_count
    FROM operational_zones ORDER BY scenario_id, id
""")
print("\n=== ALL SCENARIOS OPERATIONAL ZONES ===")
for r in cur.fetchall():
    print(r)

cur.close()
conn.close()
