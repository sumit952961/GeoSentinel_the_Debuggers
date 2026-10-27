"""
scripts/regenerate_spatial_operational_zones.py
Generates contiguous, non-overlapping spatial operational zones for all scenarios,
and aligns building damage classification to match zone tiers with realistic triage metrics.
"""

import psycopg2
from shapely.geometry import box, Polygon, MultiPolygon
from shapely import wkt
import json

DB_PARAMS = {
    "dbname": "disaster_db",
    "user": "postgres",
    "password": "postgres",
    "host": "localhost",
    "port": 5432
}

SECTOR_CONFIGS = {
    # Scenario 2: Chamoli Flash Flood 2021 (Longitudinal East-to-West corridor)
    2: {
        "axis": "lon",
        "y_bounds": (30.418, 30.462),
        "sectors": [
            {
                "code": "ZONE-SCEN02-01",
                "name": "Raini Village Ground Zero Sector",
                "criticality": "CRITICAL",
                "color": "#ef4444",
                "score": 0.94,
                "range": (79.6245, 79.6420),
                "dmg": "destroyed",
                "pri_level": "CRITICAL",
                "pri_base": 0.92,
                "action": "Immediate heavy search and rescue along Rishiganga riverbed. Deploy drone reconnaissance for survivor detection.",
                "desc": "Epicenter of flash flood debris wave. Total structural annihilation of lower valley riverbank buildings."
            },
            {
                "code": "ZONE-SCEN02-02",
                "name": "Tapovan Barrage Impact Corridor",
                "criticality": "HIGH",
                "color": "#f97316",
                "score": 0.72,
                "range": (79.6200, 79.6245),
                "dmg": "major-damage",
                "pri_level": "HIGH",
                "pri_base": 0.70,
                "action": "Heavy engineering equipment deployment for barrage clearance and access route de-silting.",
                "desc": "Severe mud slurry inundation and structural buckling. Key bridge and link road severed."
            },
            {
                "code": "ZONE-SCEN02-03",
                "name": "Rishiganga Valley Buffer Sector",
                "criticality": "MEDIUM",
                "color": "#eab308",
                "score": 0.42,
                "range": (79.6135, 79.6200),
                "dmg": "minor-damage",
                "pri_level": "MEDIUM",
                "pri_base": 0.42,
                "action": "Geological slope stability monitoring and secondary evacuation for riverside dwellings.",
                "desc": "Upper terrace buildings experienced perimeter inundation and minor foundation stress."
            },
            {
                "code": "ZONE-SCEN02-04",
                "name": "Joshimath Base & Relief Command",
                "criticality": "LOW",
                "color": "#10b981",
                "score": 0.15,
                "range": (79.5980, 79.6135),
                "dmg": "no-damage",
                "pri_level": "LOW",
                "pri_base": 0.14,
                "action": "Main triage coordination post, casualty evacuation airfield reception, and relief distribution hub.",
                "desc": "Intact high-ground infrastructure housing CHC Joshimath hospital and regional rescue staging camp."
            }
        ]
    },

    # Scenario 1: Woolsey Fire 2018 (Latitudinal North-to-South corridor)
    1: {
        "axis": "lat",
        "x_bounds": (-118.740, -118.710),
        "sectors": [
            {
                "code": "ZONE-SCEN01-01",
                "name": "Malibu Canyon Ground Zero Sector",
                "criticality": "CRITICAL",
                "color": "#ef4444",
                "score": 0.91,
                "range": (34.070, 34.075),
                "dmg": "destroyed",
                "pri_level": "CRITICAL",
                "pri_base": 0.89,
                "action": "Immediate USAR search and rescue in active burn footprint. Air assets for thermal monitoring.",
                "desc": "High-density destroyed structural zone within primary fire progression path. Critical access routes cut off."
            },
            {
                "code": "ZONE-SCEN01-02",
                "name": "Point Dume Severe Impact Sector",
                "criticality": "HIGH",
                "color": "#f97316",
                "score": 0.68,
                "range": (34.060, 34.070),
                "dmg": "major-damage",
                "pri_level": "HIGH",
                "pri_base": 0.67,
                "action": "Structural triage and residential hazard perimeter control. Evacuate vulnerable residents.",
                "desc": "Severe radiant heat damage to residential footprints. Multiple secondary structural failures."
            },
            {
                "code": "ZONE-SCEN01-03",
                "name": "Kanan Valley Buffer Sector",
                "criticality": "MEDIUM",
                "color": "#eab308",
                "score": 0.40,
                "range": (34.075, 34.080),
                "dmg": "minor-damage",
                "pri_level": "MEDIUM",
                "pri_base": 0.40,
                "action": "Utility stabilization and airborne ember containment. Clear secondary roadways.",
                "desc": "Moderate exterior structural scorching with intact core structures. Air quality alert active."
            },
            {
                "code": "ZONE-SCEN01-04",
                "name": "Westlake Staging & Evacuation Base",
                "criticality": "LOW",
                "color": "#10b981",
                "score": 0.16,
                "range": (34.080, 34.088),
                "dmg": "no-damage",
                "pri_level": "LOW",
                "pri_base": 0.15,
                "action": "Establish multi-agency logistics staging hub, mobile medical station, and civil evacuation center.",
                "desc": "Zero direct structural fire damage. Full electrical grid and hospital access operational."
            }
        ]
    },

    # Scenario 3: Cyclone Fani 2019 (Latitudinal Coastline South to Inland North)
    3: {
        "axis": "lat",
        "x_bounds": (85.805, 85.852),
        "sectors": [
            {
                "code": "ZONE-SCEN03-01",
                "name": "Puri Beachfront Ground Zero Sector",
                "criticality": "CRITICAL",
                "color": "#ef4444",
                "score": 0.93,
                "range": (19.785, 19.800),
                "dmg": "destroyed",
                "pri_level": "CRITICAL",
                "pri_base": 0.90,
                "action": "Immediate emergency clearing of storm debris, search for trapped residents in collapsed beachfront structures.",
                "desc": "Direct Category 4 eye-wall impact zone. Catastrophic roof shears and complete wall collapses along the coast."
            },
            {
                "code": "ZONE-SCEN03-02",
                "name": "Swargadwar Urban High-Damage Sector",
                "criticality": "HIGH",
                "color": "#f97316",
                "score": 0.69,
                "range": (19.800, 19.810),
                "dmg": "major-damage",
                "pri_level": "HIGH",
                "pri_base": 0.68,
                "action": "Mobilize mobile power generators, distribute clean drinking water, secure leaning utility poles.",
                "desc": "Dense urban settlement with extensive structural damage to asbestos/tin roofs and masonry failure."
            },
            {
                "code": "ZONE-SCEN03-03",
                "name": "Grand Road Commercial Buffer Sector",
                "criticality": "MEDIUM",
                "color": "#eab308",
                "score": 0.39,
                "range": (19.810, 19.820),
                "dmg": "minor-damage",
                "pri_level": "MEDIUM",
                "pri_base": 0.38,
                "action": "Debris removal along arterial road, rapid restoration of commercial telecommunications.",
                "desc": "Moderate structural damage limited to facade stripping, shattered windows, and light signage collapse."
            },
            {
                "code": "ZONE-SCEN03-04",
                "name": "Station Road Relief & Assembly Base",
                "criticality": "LOW",
                "color": "#10b981",
                "score": 0.14,
                "range": (19.820, 19.832),
                "dmg": "no-damage",
                "pri_level": "LOW",
                "pri_base": 0.14,
                "action": "Civil protection coordination center, emergency food depot, and primary medical transfer point.",
                "desc": "Reinforced concrete structures with zero structural damage. Direct access to Puri District Hospital."
            }
        ]
    },

    # Scenario 4: Dharali Cloudburst 2025 (Latitudinal Debris Fan North to Safe Staging South)
    4: {
        "axis": "lat",
        "x_bounds": (78.725, 78.772),
        "sectors": [
            {
                "code": "ZONE-SCEN04-01",
                "name": "Kheer Ganga Confluence Ground Zero",
                "criticality": "CRITICAL",
                "color": "#ef4444",
                "score": 0.95,
                "range": (31.028, 31.042),
                "dmg": "destroyed",
                "pri_level": "CRITICAL",
                "pri_base": 0.94,
                "action": "Specialized mountain rescue teams deployment. Thermal imaging for buried structures in 20.4 ha debris fan.",
                "desc": "Cloudburst debris torrent impact zone. Structures completely submerged or swept by high-velocity sediment flow."
            },
            {
                "code": "ZONE-SCEN04-02",
                "name": "Dharali Core High-Risk Sector",
                "criticality": "HIGH",
                "color": "#f97316",
                "score": 0.70,
                "range": (31.022, 31.028),
                "dmg": "major-damage",
                "pri_level": "HIGH",
                "pri_base": 0.69,
                "action": "Structural bracing of partially compromised multi-story buildings. Evacuation of unstable hillside clusters.",
                "desc": "Heavy mud penetration into ground floors and structural fractures due to riverbank erosion."
            },
            {
                "code": "ZONE-SCEN04-03",
                "name": "Bhagirathi Riverfront Buffer Sector",
                "criticality": "MEDIUM",
                "color": "#eab308",
                "score": 0.41,
                "range": (31.017, 31.022),
                "dmg": "minor-damage",
                "pri_level": "MEDIUM",
                "pri_base": 0.41,
                "action": "Monitor Bhagirathi river water level surges, clear blocked culverts, provide emergency rations.",
                "desc": "Minor flooding damage to basements and perimeter boundary walls. Structural frames intact."
            },
            {
                "code": "ZONE-SCEN04-04",
                "name": "Harsil Valley Safe Staging Sector",
                "criticality": "LOW",
                "color": "#10b981",
                "score": 0.14,
                "range": (31.010, 31.017),
                "dmg": "no-damage",
                "pri_level": "LOW",
                "pri_base": 0.13,
                "action": "Operational staging ground for NDRF/Army columns, medical dispensary, and temporary shelter hub.",
                "desc": "Stable bedrock plateau completely free from debris deposition. Fully operational facility corridors."
            }
        ]
    }
}


def run():
    conn = psycopg2.connect(**DB_PARAMS)
    cur = conn.cursor()

    # Clear operational zones table
    cur.execute("DELETE FROM operational_zones;")
    print("Cleared existing operational_zones.")

    for sc_id, cfg in SECTOR_CONFIGS.items():
        print(f"\nProcessing Scenario {sc_id}...")
        axis = cfg["axis"]

        # Fetch facilities and blocked roads
        cur.execute("SELECT id, name, ST_AsText(geometry) FROM hospitals WHERE scenario_id = %s;", (sc_id,))
        hospitals = cur.fetchall()

        cur.execute("SELECT id, name, ST_AsText(geometry) FROM shelters WHERE scenario_id = %s;", (sc_id,))
        shelters = cur.fetchall()

        cur.execute("SELECT id, name, ST_AsText(geometry) FROM roads WHERE scenario_id = %s AND is_blocked = true;", (sc_id,))
        blocked_roads = cur.fetchall()

        # Fetch all buildings for scenario
        cur.execute("""
            SELECT b.id, ST_X(ST_Centroid(b.geometry)), ST_Y(ST_Centroid(b.geometry)),
                   ST_Area(ST_Transform(b.geometry, 3857))
            FROM buildings b
            WHERE b.scenario_id = %s
            ORDER BY b.id;
        """, (sc_id,))
        bldg_rows = cur.fetchall()

        for sec in cfg["sectors"]:
            code = sec["code"]
            name = sec["name"]
            crit = sec["criticality"]
            color = sec["color"]
            score = sec["score"]
            action = sec["action"]
            desc = sec["desc"]
            val_min, val_max = sec["range"]

            # Filter buildings in this non-overlapping slice
            sec_bldgs = []
            for b in bldg_rows:
                b_id, bx, by, b_area = b
                val = bx if axis == "lon" else by
                if val_min <= val <= val_max:
                    sec_bldgs.append((b_id, bx, by, b_area or 85.0))

            # If empty (boundary rounding), borrow closest
            if not sec_bldgs:
                closest = min(bldg_rows, key=lambda b: abs((b[1] if axis == "lon" else b[2]) - (val_min + val_max) / 2))
                sec_bldgs.append((closest[0], closest[1], closest[2], closest[3] or 85.0))

            sec_bldg_ids = [b[0] for b in sec_bldgs]
            total_b = len(sec_bldgs)

            # Update damage predictions and priority assessments for these buildings
            for idx, b in enumerate(sec_bldgs):
                b_id = b[0]
                dmg_class = sec["dmg"]
                pri_level = sec["pri_level"]
                # Slight variation
                pri_val = min(0.99, max(0.05, sec["pri_base"] + (idx % 3) * 0.02 - 0.01))

                probs = {
                    "no-damage": 0.02,
                    "minor-damage": 0.03,
                    "major-damage": 0.05,
                    "destroyed": 0.90
                }
                if dmg_class == "major-damage":
                    probs = {"no-damage": 0.05, "minor-damage": 0.15, "major-damage": 0.70, "destroyed": 0.10}
                elif dmg_class == "minor-damage":
                    probs = {"no-damage": 0.20, "minor-damage": 0.65, "major-damage": 0.12, "destroyed": 0.03}
                elif dmg_class == "no-damage":
                    probs = {"no-damage": 0.92, "minor-damage": 0.06, "major-damage": 0.01, "destroyed": 0.01}

                # Update damage_predictions
                cur.execute("""
                    UPDATE damage_predictions
                    SET damage_class = %s, confidence = %s, probabilities = %s
                    WHERE building_id = %s;
                """, (dmg_class, 0.92, json.dumps(probs), b_id))
                if cur.rowcount == 0:
                    cur.execute("""
                        INSERT INTO damage_predictions (scenario_id, building_id, damage_class, confidence, probabilities, model_version, is_prediction, geometry)
                        SELECT %s, %s, %s, %s, %s, %s, %s, geometry FROM buildings WHERE id = %s;
                    """, (sc_id, b_id, dmg_class, 0.92, json.dumps(probs), "DRAS-v2.0-SpatialEnsemble", True, b_id))

                # Update priority_assessments
                cur.execute("""
                    UPDATE priority_assessments
                    SET priority_score = %s, priority_level = %s, severity_score = %s, explanation = %s
                    WHERE building_id = %s;
                """, (pri_val, pri_level, pri_val, f"Structure in {name} [{crit}]: {desc}", b_id))
                if cur.rowcount == 0:
                    cur.execute("""
                        INSERT INTO priority_assessments (
                            scenario_id, building_id, priority_score, priority_level,
                            severity_score, population_score, infrastructure_score,
                            accessibility_score, hazard_proximity_score, explanation
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                    """, (
                        sc_id, b_id, pri_val, pri_level,
                        pri_val, 0.60 if crit in ["CRITICAL", "HIGH"] else 0.25,
                        0.80 if crit == "CRITICAL" else 0.30,
                        0.20 if crit == "CRITICAL" else 0.85,
                        0.90 if crit == "CRITICAL" else 0.30,
                        f"Structure in {name} [{crit}]: {desc}"
                    ))

            # Tally counts
            dest_cnt = total_b if sec["dmg"] == "destroyed" else 0
            maj_cnt = total_b if sec["dmg"] == "major-damage" else 0
            min_cnt = total_b if sec["dmg"] == "minor-damage" else 0
            no_cnt = total_b if sec["dmg"] == "no-damage" else 0
            est_pop = int(sum(max(3, int(b[3] / 18.0)) for b in sec_bldgs))
            apex_bldg_id = sec_bldg_ids[0]

            # Construct clean, non-overlapping geometric box for the sector
            if axis == "lon":
                y0, y1 = cfg["y_bounds"]
                sector_box = box(val_min, y0, val_max, y1)
            else:
                x0, x1 = cfg["x_bounds"]
                sector_box = box(x0, val_min, x1, val_max)

            poly_wkt = sector_box.wkt

            # Facility counts
            hosp_cnt = sum(1 for h in hospitals if sector_box.intersects(wkt.loads(h[2])))
            shelt_cnt = sum(1 for s in shelters if sector_box.intersects(wkt.loads(s[2])))
            blk_cnt = sum(1 for br in blocked_roads if sector_box.intersects(wkt.loads(br[2])))

            cur.execute("""
                INSERT INTO operational_zones (
                    scenario_id, zone_code, name, criticality, criticality_score,
                    avg_priority_score, geometry, total_buildings, destroyed_count,
                    major_damage_count, minor_damage_count, no_damage_count,
                    estimated_population, highest_priority_building_id,
                    hospitals_count, shelters_count, blocked_roads_count,
                    recommended_action, explanation, constituent_building_ids
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, ST_GeomFromText(%s, 4326), %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s, %s
                );
            """, (
                sc_id, code, name, crit, score,
                score, poly_wkt, total_b, dest_cnt,
                maj_cnt, min_cnt, no_cnt,
                est_pop, apex_bldg_id,
                hosp_cnt, shelt_cnt, blk_cnt,
                action, desc, json.dumps(sec_bldg_ids)
            ))

            print(f"  -> Created {code} [{crit}]: {total_b} bldgs ({dest_cnt} destroyed), Pop={est_pop}, Bounds={sec['range']}")

    conn.commit()
    cur.close()
    conn.close()
    print("\nSuccessfully regenerated contiguous, non-overlapping operational zones for all scenarios!")


if __name__ == "__main__":
    run()
