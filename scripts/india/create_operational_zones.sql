-- Operational Zones Table for DRAS v2.0
CREATE TABLE IF NOT EXISTS operational_zones (
    id SERIAL PRIMARY KEY,
    scenario_id INTEGER REFERENCES disaster_scenarios(id) ON DELETE CASCADE,
    zone_code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    criticality VARCHAR(20) NOT NULL, -- CRITICAL, HIGH, MEDIUM, LOW
    criticality_score DOUBLE PRECISION DEFAULT 0.0,
    total_buildings INTEGER DEFAULT 0,
    destroyed_count INTEGER DEFAULT 0,
    major_damage_count INTEGER DEFAULT 0,
    minor_damage_count INTEGER DEFAULT 0,
    no_damage_count INTEGER DEFAULT 0,
    estimated_population INTEGER DEFAULT 0,
    avg_priority_score DOUBLE PRECISION DEFAULT 0.0,
    hospitals_count INTEGER DEFAULT 0,
    shelters_count INTEGER DEFAULT 0,
    blocked_roads_count INTEGER DEFAULT 0,
    highest_priority_building_id INTEGER,
    recommended_action TEXT,
    explanation TEXT,
    constituent_building_ids JSONB,
    geometry GEOMETRY(Polygon, 4326) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_op_zones_geom ON operational_zones USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_op_zones_scenario ON operational_zones(scenario_id);
