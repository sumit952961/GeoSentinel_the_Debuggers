import psycopg2
import os
from pathlib import Path

def run_migration():
    # Database connection parameters
    db_params = {
        'host': 'localhost',
        'port': '5432',
        'user': 'postgres',
        'password': 'postgres',
        'dbname': 'disaster_db'
    }

    # Path to the SQL file
    script_dir = Path(__file__).parent
    sql_file = script_dir / 'migrate_india_schema.sql'
    
    if not sql_file.exists():
        print(f"Error: Migration file not found at {sql_file}")
        return

    try:
        print(f"Connecting to database {db_params['dbname']}...")
        conn = psycopg2.connect(**db_params)
        conn.autocommit = True
        
        with conn.cursor() as cur:
            with open(sql_file, 'r') as f:
                sql_content = f.read()
            
            print("Executing migration script...")
            cur.execute(sql_content)
            
            print("Migration executed successfully.")
            print("The following tables/columns were updated or created:")
            print("- disaster_scenarios (Added: state, district, country, disaster_subtype, data_provenance)")
            print("- roads (Added: hazard_level, accessibility_cost, road_type)")
            print("- priority_assessments (Added: hazard_proximity_score, weight_hazard_proximity)")
            print("- damage_predictions (Added: label_source, label_confidence)")
            print("- Created table: hazard_zones")
            print("- Created table: administrative_areas")
            print("- Created table: data_sources")
            print("- Created table: model_versions")
            
    except Exception as e:
        print(f"An error occurred during migration: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()
            print("Database connection closed.")

if __name__ == "__main__":
    run_migration()
