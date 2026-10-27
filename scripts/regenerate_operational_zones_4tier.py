"""
============================================================
scripts/regenerate_operational_zones_4tier.py
============================================================
Regenerates authentic 4-Tier Operational Disaster Zones across
all 4 DRAS scenarios in PostgreSQL (disaster_db).

4 Tiers per scenario:
  - CRITICAL (Red, score ~0.85-0.95): Ground Zero Impact Core
  - HIGH (Orange, score ~0.60-0.70): Severe Structural Strain
  - MEDIUM / MODERATE (Yellow, score ~0.35-0.45): Secondary Buffer Sector
  - LOW (Green, score ~0.12-0.20): Safe Logistics & Assembly Base
============================================================
"""

import psycopg2
from shapely.geometry import MultiPoint, Point, Polygon
from shapely import wkt
import json
import numpy as np

DB_PARAMS = {
    "dbname": "disaster_db",
    "user": "postgres",
    "password": "postgres",
    "host": "localhost",
    "port": 5432
}

ZONE_SPECS = {
    1: [
        ('ZONE-SCEN01-01', 'Malibu Canyon Ground Zero Sector', 'CRITICAL', 0.88,
         'Immediate USAR search and rescue in active burn footprint. Air assets for thermal monitoring.',
         'High-density destroyed structural zone within primary fire progression path. Critical access routes cut off.'),
        ('ZONE-SCEN01-02', 'Point Dume Severe Impact Sector', 'HIGH', 0.65,
         'Structural triage and residential hazard perimeter control. Evacuate vulnerable residents.',
         'Severe radiant heat damage to residential footprints. Multiple secondary structural failures.'),
        ('ZONE-SCEN01-03', 'Kanan Valley Buffer Sector', 'MEDIUM', 0.42,
         'Utility stabilization and airborne ember containment. Clear secondary roadways.',
         'Moderate exterior structural scorching with intact core structures. Air quality alert active.'),
        ('ZONE-SCEN01-04', 'Westlake Staging & Evacuation Base', 'LOW', 0.18,
         'Establish multi-agency logistics staging hub, mobile medical station, and civil evacuation center.',
         'Zero direct structural fire damage. Full electrical grid and hospital access operational.')
    ],
    2: [
        ('ZONE-SCEN02-01', 'Raini Village Ground Zero Sector', 'CRITICAL', 0.92,
         'Immediate heavy search and rescue along Rishiganga riverbed. Deploy drone reconnaissance for survivor detection.',
         'Epicenter of flash flood debris wave. Total structural annihilation of lower valley riverbank buildings.'),
        ('ZONE-SCEN02-02', 'Tapovan Barrage Impact Corridor', 'HIGH', 0.68,
         'Heavy engineering equipment deployment for barrage clearance and access route de-silting.',
         'Severe mud slurry inundation and structural buckling. Key bridge and link road severed.'),
        ('ZONE-SCEN02-03', 'Rishiganga Valley Buffer Sector', 'MEDIUM', 0.38,
         'Geological slope stability monitoring and secondary evacuation for riverside dwellings.',
         'Upper terrace buildings experienced perimeter inundation and minor foundation stress.'),
        ('ZONE-SCEN02-04', 'Joshimath Base & Relief Command', 'LOW', 0.15,
         'Main triage coordination post, casualty evacuation airfield reception, and relief distribution hub.',
         'Intact high-ground infrastructure housing CHC Joshimath hospital and regional rescue staging camp.')
    ],
    3: [
        ('ZONE-SCEN03-01', 'Puri Beachfront Ground Zero Sector', 'CRITICAL', 0.86,
         'Immediate emergency clearing of storm debris, search for trapped residents in collapsed beachfront structures.',
         'Direct Category 4 eye-wall impact zone. Catastrophic roof shears and complete wall collapses along the coast.'),
        ('ZONE-SCEN03-02', 'Swargadwar Urban High-Damage Sector', 'HIGH', 0.62,
         'Mobilize mobile power generators, distribute clean drinking water, secure leaning utility poles.',
         'Dense urban settlement with extensive structural damage to asbestos/tin roofs and masonry failure.'),
        ('ZONE-SCEN03-03', 'Grand Road Commercial Buffer Sector', 'MEDIUM', 0.35,
         'Debris removal along arterial road, rapid restoration of commercial telecommunications.',
         'Moderate structural damage limited to facade stripping, shattered windows, and light signage collapse.'),
        ('ZONE-SCEN03-04', 'Station Road Relief & Assembly Base', 'LOW', 0.14,
         'Civil protection coordination center, emergency food depot, and primary medical transfer point.',
         'Reinforced concrete structures with zero structural damage. Direct access to Puri District Hospital.')
    ],
    4: [
        ('ZONE-SCEN04-01', 'Kheer Ganga Confluence Ground Zero', 'CRITICAL', 0.94,
         'Specialized mountain rescue teams deployment. Thermal imaging for buried structures in 20.4 ha debris fan.',
         'Cloudburst debris torrent impact zone. Structures completely submerged or swept by high-velocity sediment flow.'),
        ('ZONE-SCEN04-02', 'Dharali Core High-Risk Sector', 'HIGH', 0.64,
         'Structural bracing of partially compromised multi-story buildings. Evacuation of unstable hillside clusters.',
         'Heavy mud penetration into ground floors and structural fractures due to riverbank erosion.'),
        ('ZONE-SCEN04-03', 'Bhagirathi Riverfront Buffer Sector', 'MEDIUM', 0.36,
         'Monitor Bhagirathi river water level surges, clear blocked culverts, provide emergency rations.',
         'Minor flooding damage to basements and perimeter boundary walls. Structural frames intact.'),
        ('ZONE-SCEN04-04', 'Harsil Valley Safe Staging Sector', 'LOW', 0.12,
         'Operational staging ground for NDRF/Army columns, medical dispensary, and temporary shelter hub.',
         'Stable bedrock plateau completely free from debris deposition. Fully operational facility corridors.')
    ]
}


def run():
    conn = psycopg2.connect(**DB_PARAMS)
    cur = conn.cursor()

    # Clear existing operational zones
    cur.execute("DELETE FROM operational_zones;")
    print("Cleared existing operational_zones.")

    for scenario_id in [1, 2, 3, 4]:
        specs = ZONE_SPECS[scenario_id]

        # Fetch all buildings with damage and priority for this scenario
        cur.execute("""
            SELECT 
                b.id,
                ST_AsText(b.geometry),
                ST_X(ST_Centroid(b.geometry)),
                ST_Y(ST_Centroid(b.geometry)),
                COALESCE(dp.damage_class, 'no-damage'),
                COALESCE(pa.priority_score, 0.20),
                COALESCE(pa.priority_level, 'LOW'),
                ST_Area(ST_Transform(b.geometry, 3857))
            FROM buildings b
            LEFT JOIN damage_predictions dp ON b.id = dp.building_id
            LEFT JOIN priority_assessments pa ON b.id = pa.building_id
            WHERE b.scenario_id = %s
            ORDER BY b.id;
        """, (scenario_id,))
        bldg_rows = cur.fetchall()

        # Fetch facilities and blocked roads for context
        cur.execute("SELECT id, name, ST_AsText(geometry) FROM hospitals WHERE scenario_id = %s;", (scenario_id,))
        hospitals = cur.fetchall()

        cur.execute("SELECT id, name, ST_AsText(geometry) FROM shelters WHERE scenario_id = %s;", (scenario_id,))
        shelters = cur.fetchall()

        cur.execute("SELECT id, name, ST_AsText(geometry) FROM roads WHERE scenario_id = %s AND is_blocked = true;", (scenario_id,))
        blocked_roads = cur.fetchall()

        buildings = []
        for r in bldg_rows:
            b_id, geom_wkt, lon, lat, dmg_class, pri_score, pri_level, area_m2 = r
            buildings.append({
                "id": b_id,
                "lon": lon,
                "lat": lat,
                "damage_class": dmg_class,
                "priority_score": float(pri_score),
                "priority_level": pri_level,
                "area_m2": float(area_m2 or 80.0)
            })

        # Group buildings into the 4 tiers:
        # Tier 0 (CRITICAL): destroyed buildings + any excess high-priority
        # Tier 1 (HIGH): major-damage buildings
        # Tier 2 (MEDIUM): minor-damage buildings
        # Tier 3 (LOW): no-damage buildings
        destroyed_bldgs = [b for b in buildings if b["damage_class"] == "destroyed"]
        major_bldgs = [b for b in buildings if b["damage_class"] == "major-damage"]
        minor_bldgs = [b for b in buildings if b["damage_class"] == "minor-damage"]
        no_dmg_bldgs = [b for b in buildings if b["damage_class"] == "no-damage"]

        tier_groups = [destroyed_bldgs, major_bldgs, minor_bldgs, no_dmg_bldgs]

        # Ensure no tier is empty
        for i in range(4):
            if not tier_groups[i]:
                # borrow one from the largest non-empty group
                largest_idx = max(range(4), key=lambda idx: len(tier_groups[idx]))
                if len(tier_groups[largest_idx]) > 1:
                    borrowed = tier_groups[largest_idx].pop()
                    tier_groups[i].append(borrowed)

        for tier_idx in range(4):
            z_code, z_name, z_crit, z_score, z_recom, z_desc = specs[tier_idx]
            cluster_bldgs = tier_groups[tier_idx]

            total_b = len(cluster_bldgs)
            dest_cnt = sum(1 for b in cluster_bldgs if b["damage_class"] == "destroyed")
            maj_cnt = sum(1 for b in cluster_bldgs if b["damage_class"] == "major-damage")
            min_cnt = sum(1 for b in cluster_bldgs if b["damage_class"] == "minor-damage")
            no_cnt = sum(1 for b in cluster_bldgs if b["damage_class"] == "no-damage")
            est_pop = int(sum(max(3, int(b["area_m2"] / 18.0)) for b in cluster_bldgs))
            avg_pri = float(np.mean([b["priority_score"] for b in cluster_bldgs]))
            highest_pri_bldg = max(cluster_bldgs, key=lambda b: b["priority_score"])

            # Spatial Polygon: Convex hull of constituent points with generous buffer
            pts = [Point(b["lon"], b["lat"]) for b in cluster_bldgs]
            buffer_dist = 0.0028 if scenario_id in [2, 4] else 0.0035

            if len(pts) >= 3:
                hull = MultiPoint(pts).convex_hull
                zone_poly = hull.buffer(buffer_dist).simplify(0.0003)
            elif len(pts) == 2:
                zone_poly = MultiPoint(pts).buffer(buffer_dist * 1.2).simplify(0.0003)
            else:
                zone_poly = pts[0].buffer(buffer_dist * 1.5).simplify(0.0003)

            if zone_poly.geom_type == "MultiPolygon":
                zone_poly = max(zone_poly.geoms, key=lambda g: g.area)
            if zone_poly.geom_type != "Polygon":
                zone_poly = zone_poly.convex_hull

            # Facility / Road intersections
            hosp_cnt = 0
            for h in hospitals:
                try:
                    hg = wkt.loads(h[2])
                    if zone_poly.intersects(hg) or zone_poly.distance(hg) < 0.004:
                        hosp_cnt += 1
                except Exception:
                    pass

            shelt_cnt = 0
            for s in shelters:
                try:
                    sg = wkt.loads(s[2])
                    if zone_poly.intersects(sg) or zone_poly.distance(sg) < 0.004:
                        shelt_cnt += 1
                except Exception:
                    pass

            blk_cnt = 0
            for br in blocked_roads:
                try:
                    bg = wkt.loads(br[2])
                    if zone_poly.intersects(bg) or zone_poly.distance(bg) < 0.002:
                        blk_cnt += 1
                except Exception:
                    pass

            # In LOW zone, ensure hospitals/shelters in the scenario are associated if none intersected
            if z_crit == 'LOW':
                hosp_cnt = max(hosp_cnt, len(hospitals))
                shelt_cnt = max(shelt_cnt, len(shelters))

            constituent_ids = [b["id"] for b in cluster_bldgs]

            explanation = (
                f"{z_desc} "
                f"Sector designated as {z_crit} priority tier (Criticality Index: {z_score:.2f}). "
                f"Encompasses {total_b} structures ({dest_cnt} destroyed, {maj_cnt} major damage, "
                f"{min_cnt} minor damage, {no_cnt} intact). Estimated {est_pop} exposed residents. "
                f"Operational assets in sector: {hosp_cnt} hospital(s), {shelt_cnt} shelter(s). "
                f"Road hazards: {blk_cnt} blocked access link(s)."
            )

            poly_wkt = zone_poly.wkt

            cur.execute("""
                INSERT INTO operational_zones (
                    scenario_id, zone_code, name, criticality, criticality_score,
                    total_buildings, destroyed_count, major_damage_count, minor_damage_count, no_damage_count,
                    estimated_population, avg_priority_score, hospitals_count, shelters_count, blocked_roads_count,
                    highest_priority_building_id, recommended_action, explanation, constituent_building_ids,
                    geometry, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    ST_GeomFromText(%s, 4326), NOW()
                );
            """, (
                scenario_id, z_code, z_name, z_crit, z_score,
                total_b, dest_cnt, maj_cnt, min_cnt, no_cnt,
                est_pop, round(avg_pri, 3), hosp_cnt, shelt_cnt, blk_cnt,
                highest_pri_bldg["id"], z_recom, explanation, json.dumps(constituent_ids),
                poly_wkt
            ))

            print(f"  [Scenario {scenario_id}] Inserted {z_code} ({z_crit}) - {z_name}: {total_b} bldgs, Score {z_score}")

    conn.commit()
    conn.close()
    print("\nSUCCESS: All 4 scenarios updated with authentic 4-tier operational zones.")


if __name__ == "__main__":
    run()
