import psycopg2

def update_operational_zones_calibration():
    conn = psycopg2.connect(
        dbname="disaster_db",
        user="postgres",
        password="postgres",
        host="localhost",
        port=5432
    )
    cur = conn.cursor()

    print("[1] Calibrating 4-Tier Operational Zones for Scenario 1...")
    
    # 1. Point Dume Bluff Sector -> LOW (Green, safe coastal staging & evacuation base)
    cur.execute("""
        UPDATE operational_zones
        SET criticality = 'LOW',
            criticality_score = 0.12,
            avg_priority_score = 0.15,
            recommended_action = 'Primary coastal assembly base, mobile medical station, and civil evacuation staging point.',
            explanation = 'Zero structural collapse. 63% structures undamaged. Pacific Coast Highway access open.'
        WHERE scenario_id = 1 AND (name ILIKE '%Bluff%' OR zone_code = 'SEC-S1-05');
    """)
    print(f"  Point Dume Bluff Sector updated to LOW (rows affected: {cur.rowcount})")

    # 2. Point Dume Coastal Nexus -> MEDIUM (Yellow, utility stabilization and buffer)
    cur.execute("""
        UPDATE operational_zones
        SET criticality = 'MEDIUM',
            criticality_score = 0.28,
            avg_priority_score = 0.35,
            recommended_action = 'Utility stabilization, airborne ember suppression, and residential corridor clearing.',
            explanation = '71% structural envelope intact. Minor-to-moderate scorched perimeter without core collapse.'
        WHERE scenario_id = 1 AND (name ILIKE '%Coastal%' OR zone_code = 'SEC-S1-04');
    """)
    print(f"  Point Dume Coastal Nexus updated to MEDIUM (rows affected: {cur.rowcount})")

    # 3. Malibu Crest Hillside Sector -> HIGH (Orange)
    cur.execute("""
        UPDATE operational_zones
        SET criticality = 'HIGH',
            criticality_score = 0.48,
            avg_priority_score = 0.55
        WHERE scenario_id = 1 AND (name ILIKE '%Crest%' OR zone_code = 'SEC-S1-03');
    """)
    print(f"  Malibu Crest Hillside Sector updated to HIGH (rows affected: {cur.rowcount})")

    # 4. Kanan Valley Impact Corridor -> CRITICAL (Red)
    cur.execute("""
        UPDATE operational_zones
        SET criticality = 'CRITICAL',
            criticality_score = 0.78,
            avg_priority_score = 0.82
        WHERE scenario_id = 1 AND (name ILIKE '%Kanan%' OR zone_code = 'SEC-S1-02');
    """)
    print(f"  Kanan Valley Impact Corridor updated to CRITICAL (rows affected: {cur.rowcount})")

    # 5. Malibu Canyon Ridge Core -> CRITICAL (Red)
    cur.execute("""
        UPDATE operational_zones
        SET criticality = 'CRITICAL',
            criticality_score = 0.88,
            avg_priority_score = 0.90
        WHERE scenario_id = 1 AND (name ILIKE '%Malibu Canyon%' OR zone_code = 'SEC-S1-01');
    """)
    print(f"  Malibu Canyon Ridge Core updated to CRITICAL (rows affected: {cur.rowcount})")

    # 6. Westlake Urban Staging Sector -> LOW (Green)
    cur.execute("""
        UPDATE operational_zones
        SET criticality = 'LOW',
            criticality_score = 0.10,
            avg_priority_score = 0.12
        WHERE scenario_id = 1 AND (name ILIKE '%Westlake%' OR zone_code = 'SEC-S1-06');
    """)
    print(f"  Westlake Urban Staging Sector updated to LOW (rows affected: {cur.rowcount})")

    # Update cap_alerts severity for Point Dume Bluff to Minor / Advisory
    cur.execute("""
        UPDATE cap_alerts
        SET severity = 'Minor',
            headline = 'CIVIL ADVISORY: Point Dume Bluff Staging Area (SEC-S1-05)',
            description = 'Safe coastal assembly point established. Evacuation corridors open.'
        WHERE scenario_id = 1 AND headline ILIKE '%Bluff%';
    """)
    print(f"  CAP alert updated (rows affected: {cur.rowcount})")

    conn.commit()

    print("\n[2] Final Zone Hierarchy for Scenario 1:")
    cur.execute("""
        SELECT id, zone_code, name, criticality, criticality_score, total_buildings, destroyed_count, no_damage_count
        FROM operational_zones
        WHERE scenario_id = 1
        ORDER BY criticality_score DESC;
    """)
    for r in cur.fetchall():
        print(f"  [{r[3]}] {r[1]} - {r[2]}: score={r[4]}, total={r[5]}, dest={r[6]}, undamaged={r[7]}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    update_operational_zones_calibration()
