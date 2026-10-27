-- Add India-specific columns to disaster_scenarios
ALTER TABLE disaster_scenarios ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE disaster_scenarios ADD COLUMN IF NOT EXISTS district VARCHAR(100);
ALTER TABLE disaster_scenarios ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'India';
ALTER TABLE disaster_scenarios ADD COLUMN IF NOT EXISTS disaster_subtype VARCHAR(100);
ALTER TABLE disaster_scenarios ADD COLUMN IF NOT EXISTS data_provenance TEXT;

-- Add hazard/accessibility columns to roads
ALTER TABLE roads ADD COLUMN IF NOT EXISTS hazard_level VARCHAR(20) DEFAULT 'NONE';
ALTER TABLE roads ADD COLUMN IF NOT EXISTS accessibility_cost DOUBLE PRECISION DEFAULT 1.0;
ALTER TABLE roads ADD COLUMN IF NOT EXISTS road_type VARCHAR(50);

-- Add hazard proximity to priority_assessments  
ALTER TABLE priority_assessments ADD COLUMN IF NOT EXISTS hazard_proximity_score DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE priority_assessments ADD COLUMN IF NOT EXISTS weight_hazard_proximity DOUBLE PRECISION DEFAULT 0.10;

-- Add label provenance to damage_predictions
ALTER TABLE damage_predictions ADD COLUMN IF NOT EXISTS label_source VARCHAR(50) DEFAULT 'model';
ALTER TABLE damage_predictions ADD COLUMN IF NOT EXISTS label_confidence DOUBLE PRECISION DEFAULT 0.0;

-- Hazard zones table
CREATE TABLE IF NOT EXISTS hazard_zones (
  id SERIAL PRIMARY KEY,
  scenario_id INTEGER REFERENCES disaster_scenarios(id) ON DELETE CASCADE,
  hazard_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'MODERATE',
  description TEXT,
  source TEXT,
  geometry GEOMETRY(Polygon, 4326) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_hazard_geom ON hazard_zones USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_hazard_scenario ON hazard_zones(scenario_id);

-- Administrative areas table  
CREATE TABLE IF NOT EXISTS administrative_areas (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  level VARCHAR(20) NOT NULL,
  parent_id INTEGER,
  state VARCHAR(100),
  geometry GEOMETRY(MultiPolygon, 4326),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_geom ON administrative_areas USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_admin_level ON administrative_areas(level);

-- Data provenance tracking
CREATE TABLE IF NOT EXISTS data_sources (
  id SERIAL PRIMARY KEY,
  scenario_id INTEGER REFERENCES disaster_scenarios(id) ON DELETE CASCADE,
  source_name VARCHAR(200) NOT NULL,
  source_url TEXT,
  acquisition_date DATE,
  spatial_resolution VARCHAR(50),
  crs VARCHAR(20) DEFAULT 'EPSG:4326',
  license TEXT,
  data_type VARCHAR(50),
  confidence DOUBLE PRECISION,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Model versions registry
CREATE TABLE IF NOT EXISTS model_versions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  version VARCHAR(20) NOT NULL,
  architecture VARCHAR(100),
  training_dataset TEXT,
  training_events TEXT,
  test_events TEXT,
  metrics JSONB,
  checkpoint_path TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
