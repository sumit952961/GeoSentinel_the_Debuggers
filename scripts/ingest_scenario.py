"""
============================================================
Disaster Management System — PostGIS Scenario Ingestion Script
============================================================

Purpose:
  Populates PostgreSQL/PostGIS with the prepared xBD disaster
  scenario and the OpenStreetMap infrastructure data.

Tables populated:
  1. disaster_scenarios  (The Woolsey Fire disaster event)
  2. buildings           (Building footprints with WGS84 polygons)
  3. damage_predictions  (Ground-truth & model damage polygons)
  4. roads               (Road network with LineStrings & blockages)
  5. hospitals           (Hospitals & Clinics with Points)
  6. shelters            (Relief shelters with Points)

Coordinate System:
  SRID 4326 (WGS84 Longitude, Latitude)
"""

import os
import sys
import json
import psycopg2
from psycopg2.extras import execute_values
from shapely import wkt
from shapely.geometry import shape

DB_PARAMS = {
    "dbname": "disaster_db",
    "user": "postgres",
    "password": "postgres",
    "host": "localhost",
    "port": 5432
}

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
XBD_DIR = os.path.join(DATA_DIR, "xbd_subset")
OSM_DIR = os.path.join(DATA_DIR, "osm")


def get_db_connection():
    return psycopg2.connect(**DB_PARAMS)


def ingest_scenario(conn):
    print("[PostGIS] Ingesting Disaster Scenario: '2018 Southern California Wildfire'...")
    cursor = conn.cursor()

    # Clean existing demo scenario if present to allow idempotent re-runs
    cursor.execute("SELECT id FROM disaster_scenarios WHERE name = %s;", ("2018 Southern California Wildfire (Woolsey Fire)",))
    existing = cursor.fetchone()
    if existing:
        scenario_id = existing[0]
        print(f"  Existing scenario found (ID: {scenario_id}). Cleaning old associated records...")
        cursor.execute("DELETE FROM damage_predictions WHERE scenario_id = %s;", (scenario_id,))
        cursor.execute("DELETE FROM buildings WHERE scenario_id = %s;", (scenario_id,))
        cursor.execute("DELETE FROM roads WHERE scenario_id = %s;", (scenario_id,))
        cursor.execute("DELETE FROM hospitals WHERE scenario_id = %s;", (scenario_id,))
        cursor.execute("DELETE FROM shelters WHERE scenario_id = %s;", (scenario_id,))
        cursor.execute("DELETE FROM disaster_scenarios WHERE id = %s;", (scenario_id,))
        conn.commit()

    insert_scenario_sql = """
    INSERT INTO disaster_scenarios (
        name, description, disaster_type, event_date, location_name,
        center_point, boundary, data_source, is_demo
    ) VALUES (
        %s, %s, %s, %s, %s,
        ST_SetSRID(ST_MakePoint(-118.6850, 34.0522), 4326),
        ST_SetSRID(ST_MakePolygon(ST_GeomFromText('LINESTRING(-118.85 34.00, -118.55 34.00, -118.55 34.12, -118.85 34.12, -118.85 34.00)')), 4326),
        %s, %s
    ) RETURNING id;
    """
    cursor.execute(insert_scenario_sql, (
        "2018 Southern California Wildfire (Woolsey Fire)",
        "Major destructive wildfire in Los Angeles and Ventura counties that burned 96,949 acres and destroyed over 1,600 structures.",
        "WILDFIRE",
        "2018-11-08",
        "Malibu / Ventura County, California, USA",
        "xBD",
        True
    ))
    scenario_id = cursor.fetchone()[0]
    conn.commit()
    print(f"  Created Disaster Scenario ID: {scenario_id}")
    return scenario_id


def ingest_buildings_and_damage(conn, scenario_id):
    print("[PostGIS] Ingesting building footprints and damage annotations from xBD...")
    cursor = conn.cursor()

    annotations_dir = os.path.join(XBD_DIR, "annotations")
    if not os.path.exists(annotations_dir):
        print(f"  [Warning] Annotations directory not found: {annotations_dir}")
        return 0

    json_files = [f for f in os.listdir(annotations_dir) if f.endswith("_post_disaster.json")]
    print(f"  Found {len(json_files)} annotation files to ingest.")

    total_buildings = 0
    building_rows = []
    damage_rows = []

    for j_file in json_files:
        with open(os.path.join(annotations_dir, j_file), "r") as f:
            data = json.load(f)

        features = data.get("features", {}).get("lng_lat", [])
        for feat in features:
            wkt_str = feat.get("wkt", "")
            props = feat.get("properties", {})
            subtype = props.get("subtype", "no-damage")
            b_type = props.get("feature_type", "building")
            
            try:
                poly = wkt.loads(wkt_str)
                if not poly.is_valid or poly.is_empty:
                    continue
                
                # Confidence score mapping for ground truth demo
                conf = 1.0 if subtype != "unclassified" else 0.8

                building_rows.append((scenario_id, wkt_str, b_type, "xbd"))
                damage_rows.append((scenario_id, subtype, conf, wkt_str, "xbd_v1"))
                total_buildings += 1
            except Exception:
                continue

    if building_rows:
        # Batch insert buildings
        building_insert_sql = """
        INSERT INTO buildings (scenario_id, geometry, building_type, source)
        VALUES (%s, ST_SetSRID(ST_GeomFromText(%s), 4326), %s, %s);
        """
        for r in building_rows:
            cursor.execute(building_insert_sql, r)

        # Batch insert damage predictions
        damage_insert_sql = """
        INSERT INTO damage_predictions (scenario_id, damage_class, confidence, geometry, model_version)
        VALUES (%s, %s, %s, ST_SetSRID(ST_GeomFromText(%s), 4326), %s);
        """
        for r in damage_rows:
            cursor.execute(damage_insert_sql, r)

        conn.commit()

    print(f"  Successfully ingested {total_buildings} building polygons and damage records.")
    return total_buildings


def ingest_osm_layers(conn, scenario_id):
    cursor = conn.cursor()

    # 1. Hospitals
    hosp_file = os.path.join(OSM_DIR, "hospitals.geojson")
    if os.path.exists(hosp_file):
        print("[PostGIS] Ingesting hospitals...")
        with open(hosp_file, "r") as f:
            hosp_data = json.load(f)

        hosp_count = 0
        for feat in hosp_data.get("features", []):
            props = feat.get("properties", {})
            geom = feat.get("geometry", {})
            lon, lat = geom.get("coordinates", [0, 0])
            
            cursor.execute("""
                INSERT INTO hospitals (scenario_id, osm_id, name, capacity, is_operational, phone, geometry)
                VALUES (%s, %s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326));
            """, (
                scenario_id,
                props.get("osm_id"),
                props.get("name", "Medical Facility"),
                props.get("capacity", 50),
                props.get("is_operational", True),
                props.get("phone", "N/A"),
                lon,
                lat
            ))
            hosp_count += 1
        conn.commit()
        print(f"  Ingested {hosp_count} hospitals.")

    # 2. Shelters
    shelter_file = os.path.join(OSM_DIR, "shelters.geojson")
    if os.path.exists(shelter_file):
        print("[PostGIS] Ingesting shelters...")
        with open(shelter_file, "r") as f:
            shelter_data = json.load(f)

        shelter_count = 0
        for feat in shelter_data.get("features", []):
            props = feat.get("properties", {})
            geom = feat.get("geometry", {})
            lon, lat = geom.get("coordinates", [0, 0])
            
            cursor.execute("""
                INSERT INTO shelters (scenario_id, osm_id, name, capacity, is_operational, shelter_type, geometry)
                VALUES (%s, %s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326));
            """, (
                scenario_id,
                props.get("osm_id"),
                props.get("name", "Relief Shelter"),
                props.get("capacity", 200),
                props.get("is_operational", True),
                props.get("shelter_type", "emergency"),
                lon,
                lat
            ))
            shelter_count += 1
        conn.commit()
        print(f"  Ingested {shelter_count} shelters.")

    # 3. Roads
    road_file = os.path.join(OSM_DIR, "roads.geojson")
    if os.path.exists(road_file):
        print("[PostGIS] Ingesting road network...")
        with open(road_file, "r") as f:
            road_data = json.load(f)

        road_count = 0
        for feat in road_data.get("features", []):
            props = feat.get("properties", {})
            geom = feat.get("geometry", {})
            coords = geom.get("coordinates", [])
            if len(coords) < 2:
                continue

            # Construct WKT LineString: "LINESTRING(lon1 lat1, lon2 lat2, ...)"
            coord_str = ", ".join([f"{pt[0]} {pt[1]}" for pt in coords])
            wkt_linestring = f"LINESTRING({coord_str})"

            cursor.execute("""
                INSERT INTO roads (scenario_id, osm_id, name, highway_type, is_blocked, block_reason, cost_multiplier, geometry)
                VALUES (%s, %s, %s, %s, %s, %s, %s, ST_SetSRID(ST_GeomFromText(%s), 4326));
            """, (
                scenario_id,
                props.get("osm_id"),
                props.get("name", "Road"),
                props.get("highway_type", "residential"),
                props.get("is_blocked", False),
                props.get("block_reason"),
                props.get("cost_multiplier", 1.0),
                wkt_linestring
            ))
            road_count += 1
        conn.commit()
        print(f"  Ingested {road_count} road segments.")


def main():
    print("=" * 65)
    print("Disaster Management System — PostGIS Ingestion Pipeline")
    print("=" * 65)

    try:
        conn = get_db_connection()
        print("[PostGIS] Database connection established.")
    except Exception as e:
        print(f"[Error] Failed to connect to PostgreSQL: {e}")
        return

    scenario_id = ingest_scenario(conn)
    ingest_buildings_and_damage(conn, scenario_id)
    ingest_osm_layers(conn, scenario_id)

    # Verification query
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            (SELECT COUNT(*) FROM disaster_scenarios) as scenarios,
            (SELECT COUNT(*) FROM buildings WHERE scenario_id = %s) as buildings,
            (SELECT COUNT(*) FROM damage_predictions WHERE scenario_id = %s) as damages,
            (SELECT COUNT(*) FROM hospitals WHERE scenario_id = %s) as hospitals,
            (SELECT COUNT(*) FROM shelters WHERE scenario_id = %s) as shelters,
            (SELECT COUNT(*) FROM roads WHERE scenario_id = %s) as roads;
    """, (scenario_id, scenario_id, scenario_id, scenario_id, scenario_id))
    counts = cursor.fetchone()

    print("\n" + "=" * 65)
    print("POSTGIS INGESTION SUMMARY")
    print("=" * 65)
    print(f"  Scenarios in DB:          {counts[0]}")
    print(f"  Buildings ingested:       {counts[1]}")
    print(f"  Damage records ingested:  {counts[2]}")
    print(f"  Hospitals ingested:       {counts[3]}")
    print(f"  Shelters ingested:        {counts[4]}")
    print(f"  Road segments ingested:   {counts[5]}")
    print("=" * 65)
    conn.close()


if __name__ == "__main__":
    main()
