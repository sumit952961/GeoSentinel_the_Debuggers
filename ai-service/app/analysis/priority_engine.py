"""
============================================================
Disaster Management System — Priority & Impact Analysis Engine
============================================================

Implements:
  - Multi-Factor Explainable Priority Scoring:
      Priority = w1*Severity + w2*Population + w3*Infrastructure + w4*Accessibility
  - Factor Score Computations:
      1. Severity (S): AI Damage Class & Confidence
      2. Population (P): Controlled Demonstration occupant density from footprint area
      3. Infrastructure (I): Proximity to operational hospitals & shelters
      4. Accessibility (A): Proximity to blocked evacuation corridors vs open roads
  - Human-Readable Explanation Generator
  - PostGIS Ingestion & GeoJSON Exporter
"""

import os
import sys
import json
import psycopg2
import math
from shapely import wkt
from shapely.geometry import shape, mapping, Polygon, Point

def haversine_distance_km(lat1, lon1, lat2, lon2):
    R = 6371.0 # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTPUTS_DIR = os.path.join(ROOT_DIR, "ai-service", "outputs")
os.makedirs(OUTPUTS_DIR, exist_ok=True)

DB_PARAMS = {
    "dbname": "disaster_db",
    "user": "postgres",
    "password": "postgres",
    "host": "localhost",
    "port": 5432
}

DEFAULT_WEIGHTS = {
    "severity": 0.35,
    "population": 0.20,
    "infrastructure": 0.20,
    "accessibility": 0.15,
    "hazard_proximity": 0.10
}

# Disaster-type-specific weight profiles
DISASTER_WEIGHT_PROFILES = {
    "LANDSLIDE": {
        "severity": 0.35,
        "population": 0.20,
        "infrastructure": 0.15,
        "accessibility": 0.15,
        "hazard_proximity": 0.15
    },
    "FLASH_FLOOD": {
        "severity": 0.30,
        "population": 0.20,
        "infrastructure": 0.15,
        "accessibility": 0.25,
        "hazard_proximity": 0.10
    },
    "FLOOD": {
        "severity": 0.30,
        "population": 0.25,
        "infrastructure": 0.20,
        "accessibility": 0.10,
        "hazard_proximity": 0.15
    },
    "WILDFIRE": {
        "severity": 0.40,
        "population": 0.25,
        "infrastructure": 0.20,
        "accessibility": 0.15,
        "hazard_proximity": 0.00
    }
}


class PriorityEngine:
    def __init__(self, weights=None, disaster_type=None):
        if weights:
            self.weights = weights
        elif disaster_type and disaster_type.upper() in DISASTER_WEIGHT_PROFILES:
            self.weights = DISASTER_WEIGHT_PROFILES[disaster_type.upper()]
        else:
            self.weights = DEFAULT_WEIGHTS
        # Normalize weights to sum to 1.0
        tot = sum(self.weights.values())
        self.weights = {k: v / tot for k, v in self.weights.items()}


    def calculate_scenario_priorities(self, scenario_id=1, db_params=DB_PARAMS):
        """
        Calculates explainable priority rankings for all damage predictions in a scenario.
        """
        conn = psycopg2.connect(**db_params)
        cur = conn.cursor()

        # 1. Fetch AI Damage Predictions with geometry
        cur.execute("""
            SELECT id, building_id, damage_class, confidence, ST_AsText(geometry),
                   ST_AsText(ST_Centroid(geometry)), ST_Area(geometry::geography)
            FROM damage_predictions
            WHERE scenario_id = %s;
        """, (scenario_id,))
        damage_rows = cur.fetchall()

        # 2. Fetch Hospitals
        cur.execute("""
            SELECT id, name, capacity, is_operational, ST_AsText(geometry)
            FROM hospitals
            WHERE scenario_id = %s;
        """, (scenario_id,))
        hospital_rows = cur.fetchall()
        hospitals = []
        for h in hospital_rows:
            pt = wkt.loads(h[4])
            hospitals.append({
                "id": h[0], "name": h[1], "capacity": h[2], "operational": h[3],
                "lat": pt.y, "lon": pt.x
            })

        # 3. Fetch Shelters
        cur.execute("""
            SELECT id, name, capacity, is_operational, ST_AsText(geometry)
            FROM shelters
            WHERE scenario_id = %s;
        """, (scenario_id,))
        shelter_rows = cur.fetchall()
        shelters = []
        for s in shelter_rows:
            pt = wkt.loads(s[4])
            shelters.append({
                "id": s[0], "name": s[1], "capacity": s[2], "operational": s[3],
                "lat": pt.y, "lon": pt.x
            })

        # 4. Fetch Roads with blockage status
        cur.execute("""
            SELECT id, name, is_blocked, block_reason, ST_AsText(geometry)
            FROM roads
            WHERE scenario_id = %s;
        """, (scenario_id,))
        road_rows = cur.fetchall()
        roads = []
        for r in road_rows:
            geom = wkt.loads(r[4])
            roads.append({
                "id": r[0], "name": r[1], "blocked": r[2], "reason": r[3],
                "geom": geom
            })

        # 5. Create priority_assessments table if not exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS priority_assessments (
                id                      SERIAL PRIMARY KEY,
                scenario_id             INTEGER REFERENCES disaster_scenarios(id) ON DELETE CASCADE,
                building_id             INTEGER,
                damage_prediction_id    INTEGER,
                priority_score          DOUBLE PRECISION NOT NULL,
                priority_level          VARCHAR(20) NOT NULL,
                severity_score          DOUBLE PRECISION NOT NULL,
                population_score        DOUBLE PRECISION NOT NULL,
                infrastructure_score    DOUBLE PRECISION NOT NULL,
                accessibility_score     DOUBLE PRECISION NOT NULL,
                hazard_proximity_score  DOUBLE PRECISION DEFAULT 0.0,
                weight_severity         DOUBLE PRECISION DEFAULT 0.40,
                weight_population       DOUBLE PRECISION DEFAULT 0.25,
                weight_infrastructure   DOUBLE PRECISION DEFAULT 0.20,
                weight_accessibility    DOUBLE PRECISION DEFAULT 0.15,
                weight_hazard_proximity DOUBLE PRECISION DEFAULT 0.10,
                explanation             TEXT,
                geometry                GEOMETRY(Polygon, 4326) NOT NULL,
                created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE priority_assessments ADD COLUMN IF NOT EXISTS hazard_proximity_score DOUBLE PRECISION DEFAULT 0.0;
            ALTER TABLE priority_assessments ADD COLUMN IF NOT EXISTS weight_hazard_proximity DOUBLE PRECISION DEFAULT 0.10;
            CREATE INDEX IF NOT EXISTS idx_priority_geom ON priority_assessments USING GIST(geometry);
            CREATE INDEX IF NOT EXISTS idx_priority_scenario ON priority_assessments(scenario_id);
            CREATE INDEX IF NOT EXISTS idx_priority_level ON priority_assessments(priority_level);
        """)
        conn.commit()

        # Clean previous priority records for this scenario
        cur.execute("DELETE FROM priority_assessments WHERE scenario_id = %s;", (scenario_id,))
        conn.commit()

        results = []
        geojson_features = []
        counts_by_level = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}

        w_sev = self.weights["severity"]
        w_pop = self.weights["population"]
        w_inf = self.weights["infrastructure"]
        w_acc = self.weights["accessibility"]
        w_haz = self.weights.get("hazard_proximity", 0.0)

        # 6. Fetch Hazard Zones (if table exists)
        hazard_zones = []
        try:
            cur.execute("""
                SELECT id, hazard_type, severity, ST_AsText(geometry)
                FROM hazard_zones
                WHERE scenario_id = %s;
            """, (scenario_id,))
            for hz in cur.fetchall():
                hz_geom = wkt.loads(hz[3])
                hazard_zones.append({
                    "id": hz[0], "type": hz[1], "severity": hz[2], "geom": hz_geom
                })
        except Exception:
            conn.rollback()  # Table may not exist yet for legacy scenarios

        for row in damage_rows:
            pred_id = row[0]
            bldg_id = row[1]
            d_class = row[2]
            conf = row[3] or 0.70
            poly_wkt = row[4]
            centroid_wkt = row[5]
            area_m2 = row[6] or 120.0

            poly = wkt.loads(poly_wkt)
            centroid = wkt.loads(centroid_wkt)
            b_lat, b_lon = centroid.y, centroid.x

            # --- Factor 1: Severity Score (S) ---
            if d_class == "destroyed":
                s_base = 1.0
            elif d_class == "major-damage":
                s_base = 0.75
            elif d_class == "minor-damage":
                s_base = 0.40
            else:
                s_base = 0.05
            # Modulate base severity by prediction confidence
            sev_score = min(1.0, s_base * (0.5 + 0.5 * conf))

            # --- Factor 2: Population Exposure Score (P) ---
            # Controlled demonstration proxy: estimated occupants from footprint area
            if area_m2 < 80:
                pop_score = 0.30
                est_occupants = "1-2 occupants (compact dwelling)"
            elif area_m2 < 180:
                pop_score = 0.60
                est_occupants = "3-5 occupants (single family home)"
            elif area_m2 < 400:
                pop_score = 0.85
                est_occupants = "6-12 occupants (multi-unit / large structure)"
            else:
                pop_score = 1.00
                est_occupants = "15+ occupants (commercial / multi-family complex)"

            # --- Factor 3: Critical Infrastructure Proximity Score (I) ---
            # Proximity to emergency hospitals and shelters
            min_hosp_dist_km = min([haversine_distance_km(b_lat, b_lon, h["lat"], h["lon"]) for h in hospitals]) if hospitals else 10.0
            min_shelt_dist_km = min([haversine_distance_km(b_lat, b_lon, s["lat"], s["lon"]) for s in shelters]) if shelters else 10.0
            
            # Closer proximity to hospitals/shelters in damaged areas requires immediate triage/access
            if min_hosp_dist_km < 2.0 or min_shelt_dist_km < 1.5:
                inf_score = 0.85
                inf_desc = f"Within {min_hosp_dist_km:.1f}km of emergency hospital and {min_shelt_dist_km:.1f}km of shelter"
            elif min_hosp_dist_km < 5.0 or min_shelt_dist_km < 4.0:
                inf_score = 0.55
                inf_desc = f"Moderate distance ({min_hosp_dist_km:.1f}km to hospital, {min_shelt_dist_km:.1f}km to shelter)"
            else:
                inf_score = 0.25
                inf_desc = f"Remote location ({min_hosp_dist_km:.1f}km to nearest hospital)"

            # --- Factor 4: Accessibility / Road Impairment Score (A) ---
            # Proximity to blocked vs open roads
            blocked_distances = []
            open_distances = []
            for r in roads:
                d_km = haversine_distance_km(b_lat, b_lon, r["geom"].centroid.y, r["geom"].centroid.x)
                if r["blocked"]:
                    blocked_distances.append(d_km)
                else:
                    open_distances.append(d_km)

            min_blocked_dist = min(blocked_distances) if blocked_distances else 99.0
            min_open_dist = min(open_distances) if open_distances else 99.0

            if min_blocked_dist < 2.0:
                acc_score = 0.90
                acc_desc = f"High isolation risk: within {min_blocked_dist:.1f}km of active road blockage"
            elif min_open_dist > 3.0:
                acc_score = 0.65
                acc_desc = f"Limited access: {min_open_dist:.1f}km to nearest passable corridor"
            else:
                acc_score = 0.25
                acc_desc = f"Passable access: {min_open_dist:.1f}km to open highway"

            # --- Factor 5: Hazard Proximity Score (H) ---
            haz_score = 0.0
            haz_desc = "No active hazard zones mapped"
            if hazard_zones:
                min_haz_dist = float("inf")
                nearest_haz_type = ""
                for hz in hazard_zones:
                    try:
                        d_km = haversine_distance_km(
                            b_lat, b_lon,
                            hz["geom"].centroid.y, hz["geom"].centroid.x
                        )
                        if d_km < min_haz_dist:
                            min_haz_dist = d_km
                            nearest_haz_type = hz["type"]
                    except Exception:
                        continue
                
                if min_haz_dist < 0.5:
                    haz_score = 1.0
                    haz_desc = f"Inside/adjacent to {nearest_haz_type} zone ({min_haz_dist:.2f}km)"
                elif min_haz_dist < 2.0:
                    haz_score = 0.70
                    haz_desc = f"Near {nearest_haz_type} zone ({min_haz_dist:.1f}km)"
                elif min_haz_dist < 5.0:
                    haz_score = 0.35
                    haz_desc = f"Moderate distance from {nearest_haz_type} ({min_haz_dist:.1f}km)"
                else:
                    haz_score = 0.10
                    haz_desc = f"Distant from mapped hazard zones ({min_haz_dist:.1f}km)"

            # --- 5-Factor Weighted Linear Score ---
            priority_score = (
                (w_sev * sev_score) +
                (w_pop * pop_score) +
                (w_inf * inf_score) +
                (w_acc * acc_score) +
                (w_haz * haz_score)
            )
            priority_score = round(min(1.0, max(0.0, priority_score)), 4)

            # Assign Priority Level
            if priority_score >= 0.70:
                priority_level = "CRITICAL"
            elif priority_score >= 0.50:
                priority_level = "HIGH"
            elif priority_score >= 0.30:
                priority_level = "MEDIUM"
            else:
                priority_level = "LOW"

            counts_by_level[priority_level] += 1

            # Build Human-Readable 5-Factor Explanation
            reason = (
                f"{priority_level} PRIORITY (Score: {priority_score:.2f}) — "
                f"Severity: {d_class.upper()} ({sev_score*100:.0f}%), "
                f"Exposure: {est_occupants} ({pop_score*100:.0f}%), "
                f"Infrastructure: {inf_desc}, "
                f"Accessibility: {acc_desc}, "
                f"Hazard: {haz_desc}."
            )

            # Insert into PostGIS
            cur.execute("""
                INSERT INTO priority_assessments (
                    scenario_id, building_id, damage_prediction_id,
                    priority_score, priority_level,
                    severity_score, population_score, infrastructure_score, accessibility_score,
                    hazard_proximity_score,
                    weight_severity, weight_population, weight_infrastructure, weight_accessibility,
                    weight_hazard_proximity,
                    explanation, geometry
                ) VALUES (
                    %s, %s, %s,
                    %s, %s,
                    %s, %s, %s, %s,
                    %s,
                    %s, %s, %s, %s,
                    %s,
                    %s, ST_SetSRID(ST_GeomFromText(%s), 4326)
                ) RETURNING id;
            """, (
                scenario_id, bldg_id, pred_id,
                priority_score, priority_level,
                sev_score, pop_score, inf_score, acc_score,
                haz_score,
                w_sev, w_pop, w_inf, w_acc,
                w_haz,
                reason, poly_wkt
            ))
            pri_id = cur.fetchone()[0]

            item = {
                "id": pri_id,
                "building_id": bldg_id,
                "damage_prediction_id": pred_id,
                "priority_score": priority_score,
                "priority_level": priority_level,
                "factors": {
                    "severity_score": round(sev_score, 3),
                    "population_score": round(pop_score, 3),
                    "infrastructure_score": round(inf_score, 3),
                    "accessibility_score": round(acc_score, 3),
                    "hazard_proximity_score": round(haz_score, 3)
                },
                "weights": {
                    "w_severity": w_sev,
                    "w_population": w_pop,
                    "w_infrastructure": w_inf,
                    "w_accessibility": w_acc,
                    "w_hazard_proximity": w_haz
                },
                "damage_class": d_class,
                "confidence": conf,
                "explanation": reason
            }
            results.append(item)

            geojson_features.append({
                "type": "Feature",
                "geometry": mapping(poly),
                "properties": {
                    "id": pri_id,
                    "building_id": bldg_id,
                    "priority_score": priority_score,
                    "priority_level": priority_level,
                    "severity_score": round(sev_score, 3),
                    "population_score": round(pop_score, 3),
                    "infrastructure_score": round(inf_score, 3),
                    "accessibility_score": round(acc_score, 3),
                    "damage_class": d_class,
                    "confidence": round(conf, 3),
                    "explanation": reason,
                    "population_disclaimer": "Controlled Demonstration Data based on footprint area"
                }
            })

        conn.commit()
        conn.close()

        # Save GeoJSON export
        geojson_out = {
            "type": "FeatureCollection",
            "features": geojson_features,
            "metadata": {
                "scenario_id": scenario_id,
                "total_assessed": len(results),
                "counts_by_level": counts_by_level,
                "weights_used": self.weights,
                "formula": "Priority = w1*Severity + w2*Population + w3*Infrastructure + w4*Accessibility"
            }
        }

        geojson_path = os.path.join(OUTPUTS_DIR, "scenario1_priority_assessments.geojson")
        with open(geojson_path, "w") as f:
            json.dump(geojson_out, f, indent=2)

        print(f"\n[PriorityEngine] Computed priorities for {len(results)} locations in Scenario {scenario_id}!")
        print(f"  Critical Priority: {counts_by_level['CRITICAL']}")
        print(f"  High Priority:     {counts_by_level['HIGH']}")
        print(f"  Medium Priority:   {counts_by_level['MEDIUM']}")
        print(f"  Low Priority:      {counts_by_level['LOW']}")
        print(f"  Exported GeoJSON to: {geojson_path}")

        return geojson_out


if __name__ == "__main__":
    engine = PriorityEngine()
    engine.calculate_scenario_priorities(scenario_id=1)
