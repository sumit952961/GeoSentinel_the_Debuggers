import psycopg2
import json

conn = psycopg2.connect('dbname=disaster_db user=postgres password=postgres host=localhost')
cur = conn.cursor()

cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;")
tables = [r[0] for r in cur.fetchall()]
print(f"Tables in public schema ({len(tables)}):", tables)

for t in tables:
    if t in ['spatial_ref_sys']: continue
    try:
        cur.execute(f"SELECT COUNT(*) FROM {t};")
        cnt = cur.fetchone()[0]
        cur.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{t}' ORDER BY ordinal_position;")
        cols = [f"{c[0]} ({c[1]})" for c in cur.fetchall()]
        print(f"\n--- Table: {t} (Rows: {cnt}) ---")
        print("Columns:", ", ".join(cols))
        if cnt > 0:
            cur.execute(f"SELECT * FROM {t} LIMIT 2;")
            rows = cur.fetchall()
            # print sample
    except Exception as e:
        print(f"Error on {t}: {e}")

print("\n--- Scenarios Breakdown ---")
cur.execute("SELECT id, name, disaster_type, location_name, is_demo FROM disaster_scenarios ORDER BY id;")
scenarios = cur.fetchall()
for s in scenarios:
    s_id = s[0]
    print(f"\nScenario #{s_id}: {s[1]} | Type: {s[2]} | Location: {s[3]} | Demo: {s[4]}")
    for tbl in ['buildings', 'damage_assessments', 'priority_assessments', 'roads', 'facilities', 'routes', 'operational_zones', 'hazard_zones']:
        if tbl in tables:
            try:
                cur.execute(f"SELECT COUNT(*) FROM {tbl} WHERE scenario_id = %s;", (s_id,))
                print(f"   {tbl}: {cur.fetchone()[0]}")
            except Exception as e:
                conn.rollback()
                print(f"   {tbl}: query failed ({e})")
