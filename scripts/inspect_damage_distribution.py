import psycopg2

conn = psycopg2.connect(dbname='disaster_db', user='postgres', password='postgres', host='localhost', port=5432)
cur = conn.cursor()

print("=== SCENARIO DAMAGE DISTRIBUTION IN BUILDINGS TABLE ===")
cur.execute("""
    SELECT scenario_id, damage_class, COUNT(*)
    FROM buildings
    GROUP BY scenario_id, damage_class
    ORDER BY scenario_id, damage_class;
""")
for row in cur.fetchall():
    print(f"Scenario {row[0]}: {row[1]} -> {row[2]}")

print("\n=== SCENARIO DAMAGE DISTRIBUTION IN DAMAGE_PREDICTIONS TABLE ===")
cur.execute("""
    SELECT scenario_id, damage_class, COUNT(*)
    FROM damage_predictions
    GROUP BY scenario_id, damage_class
    ORDER BY scenario_id, damage_class;
""")
for row in cur.fetchall():
    print(f"Scenario {row[0]}: {row[1]} -> {row[2]}")

print("\n=== PER-ZONE DAMAGE DISTRIBUTION IN SCENARIO 1 (DAMAGE_PREDICTIONS) ===")
cur.execute("""
    SELECT z.name, dp.damage_class, COUNT(*)
    FROM operational_zones z
    JOIN damage_predictions dp ON ST_Intersects(z.geometry, dp.geometry)
    WHERE z.scenario_id = 1 AND dp.scenario_id = 1
    GROUP BY z.name, dp.damage_class
    ORDER BY z.name, dp.damage_class;
""")
for row in cur.fetchall():
    print(f"Zone '{row[0]}': {row[1]} -> {row[2]}")

print("\n=== PER-ZONE DAMAGE DISTRIBUTION IN SCENARIO 1 (BUILDINGS TABLE GROUND TRUTH) ===")
cur.execute("""
    SELECT z.name, b.damage_class, COUNT(*)
    FROM operational_zones z
    JOIN buildings b ON ST_Intersects(z.geometry, b.geometry)
    WHERE z.scenario_id = 1 AND b.scenario_id = 1
    GROUP BY z.name, b.damage_class
    ORDER BY z.name, b.damage_class;
""")
for row in cur.fetchall():
    print(f"Zone '{row[0]}': {row[1]} -> {row[2]}")

conn.close()
