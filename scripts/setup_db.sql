-- ============================================================
-- Disaster Management System — Database Setup Script
-- ============================================================
--
-- What this script does:
--   1. Enables PostGIS extension (for geographic data)
--   2. Creates all tables needed by the system
--   3. Creates spatial indexes for fast geographic queries
--
-- How to run:
--   First create the database (in psql or pgAdmin):
--     CREATE DATABASE disaster_db;
--
--   Then run this script against disaster_db:
--     psql -U postgres -d disaster_db -f setup_db.sql
--
--   Or paste it into pgAdmin's query tool while connected to disaster_db.
--
-- What is PostGIS?
--   PostGIS adds geographic capabilities to PostgreSQL.
--   Normal PostgreSQL can store numbers and text.
--   PostGIS adds the ability to store POINTS (lat/lon locations),
--   POLYGONS (building outlines), and LINESTRINGS (road paths),
--   and to query them spatially (e.g., "find all hospitals
--   within 5km of this point").
--
-- What is SRID 4326?
--   SRID 4326 means "WGS84" — the standard coordinate system
--   used by GPS. Coordinates are in (longitude, latitude) format.
--   This is what Google Maps, OpenStreetMap, and most mapping
--   systems use.
-- ============================================================

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Verify PostGIS is working
SELECT PostGIS_Full_Version();


-- ============================================================
-- TABLE: disaster_scenarios
-- ============================================================
-- Stores information about each disaster event we're analyzing.
-- Example: "2018 Palu Earthquake" with its location and images.
-- ============================================================
CREATE TABLE IF NOT EXISTS disaster_scenarios (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    disaster_type   VARCHAR(50) NOT NULL,
    event_date      DATE,
    location_name   VARCHAR(255),
    center_point    GEOMETRY(Point, 4326),
    boundary        GEOMETRY(Polygon, 4326),
    pre_image_path  VARCHAR(500),
    post_image_path VARCHAR(500),
    data_source     VARCHAR(100) DEFAULT 'xBD',
    is_demo         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- TABLE: processing_jobs
-- ============================================================
-- Tracks the status of each image analysis job.
-- When a user clicks "Start Analysis", we create a row here
-- and update it as processing progresses:
-- QUEUED → PREPROCESSING → ANALYZING → MAPPING → COMPLETED
-- ============================================================
CREATE TABLE IF NOT EXISTS processing_jobs (
    id                      SERIAL PRIMARY KEY,
    scenario_id             INTEGER REFERENCES disaster_scenarios(id),
    status                  VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
    total_tiles             INTEGER DEFAULT 0,
    processed_tiles         INTEGER DEFAULT 0,
    preprocessing_time_ms   BIGINT,
    inference_time_ms       BIGINT,
    total_time_ms           BIGINT,
    model_version           VARCHAR(100),
    error_message           TEXT,
    started_at              TIMESTAMP,
    completed_at            TIMESTAMP,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- TABLE: buildings
-- ============================================================
-- Stores building footprints (polygons) detected by the CV model
-- or imported from OpenStreetMap.
-- Each building is a polygon on the map.
-- ============================================================
CREATE TABLE IF NOT EXISTS buildings (
    id              SERIAL PRIMARY KEY,
    scenario_id     INTEGER REFERENCES disaster_scenarios(id),
    osm_id          BIGINT,
    geometry        GEOMETRY(Polygon, 4326) NOT NULL,
    building_type   VARCHAR(100),
    source          VARCHAR(50) DEFAULT 'model',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_buildings_geom ON buildings USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_buildings_scenario ON buildings(scenario_id);


-- ============================================================
-- TABLE: damage_predictions
-- ============================================================
-- Stores the CV model's damage predictions for each detected area.
-- Each row says: "This polygon has Major Damage with 85% confidence."
-- ============================================================
CREATE TABLE IF NOT EXISTS damage_predictions (
    id              SERIAL PRIMARY KEY,
    scenario_id     INTEGER REFERENCES disaster_scenarios(id),
    building_id     INTEGER REFERENCES buildings(id),
    job_id          INTEGER REFERENCES processing_jobs(id),
    damage_class    VARCHAR(50) NOT NULL,
    confidence      DOUBLE PRECISION,
    geometry        GEOMETRY(Polygon, 4326) NOT NULL,
    tile_x          INTEGER,
    tile_y          INTEGER,
    model_version   VARCHAR(100),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_damage_geom ON damage_predictions USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_damage_scenario ON damage_predictions(scenario_id);
CREATE INDEX IF NOT EXISTS idx_damage_class ON damage_predictions(damage_class);


-- ============================================================
-- TABLE: roads
-- ============================================================
-- Road segments from OpenStreetMap.
-- Each road is a LineString (a line on the map with start/end).
-- is_blocked = true means the road is impassable (flooding, debris).
-- cost_multiplier > 1 means the road is slow; 999999 = blocked.
-- ============================================================
CREATE TABLE IF NOT EXISTS roads (
    id              SERIAL PRIMARY KEY,
    scenario_id     INTEGER REFERENCES disaster_scenarios(id),
    osm_id          BIGINT,
    name            VARCHAR(255),
    highway_type    VARCHAR(50),
    is_blocked      BOOLEAN DEFAULT FALSE,
    block_reason    VARCHAR(255),
    cost_multiplier DOUBLE PRECISION DEFAULT 1.0,
    geometry        GEOMETRY(LineString, 4326) NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_roads_geom ON roads USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_roads_scenario ON roads(scenario_id);


-- ============================================================
-- TABLE: hospitals
-- ============================================================
-- Hospital locations from OpenStreetMap.
-- Each hospital is a Point (latitude/longitude).
-- ============================================================
CREATE TABLE IF NOT EXISTS hospitals (
    id              SERIAL PRIMARY KEY,
    scenario_id     INTEGER REFERENCES disaster_scenarios(id),
    osm_id          BIGINT,
    name            VARCHAR(255) NOT NULL,
    capacity        INTEGER,
    is_operational  BOOLEAN DEFAULT TRUE,
    phone           VARCHAR(50),
    geometry        GEOMETRY(Point, 4326) NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_hospitals_geom ON hospitals USING GIST(geometry);


-- ============================================================
-- TABLE: shelters
-- ============================================================
CREATE TABLE IF NOT EXISTS shelters (
    id              SERIAL PRIMARY KEY,
    scenario_id     INTEGER REFERENCES disaster_scenarios(id),
    osm_id          BIGINT,
    name            VARCHAR(255),
    capacity        INTEGER,
    is_operational  BOOLEAN DEFAULT TRUE,
    shelter_type    VARCHAR(100),
    geometry        GEOMETRY(Point, 4326) NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_shelters_geom ON shelters USING GIST(geometry);


-- ============================================================
-- TABLE: population_data
-- ============================================================
CREATE TABLE IF NOT EXISTS population_data (
    id              SERIAL PRIMARY KEY,
    scenario_id     INTEGER REFERENCES disaster_scenarios(id),
    zone_name       VARCHAR(255),
    population      INTEGER,
    density         DOUBLE PRECISION,
    vulnerability   VARCHAR(50),
    geometry        GEOMETRY(Polygon, 4326),
    source          VARCHAR(100),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_population_geom ON population_data USING GIST(geometry);


-- ============================================================
-- TABLE: priority_scores
-- ============================================================
-- Stores the priority engine's output.
-- Each row explains WHY a zone got its priority level.
-- factors_json contains the breakdown (damage %, population, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS priority_scores (
    id                      SERIAL PRIMARY KEY,
    scenario_id             INTEGER REFERENCES disaster_scenarios(id),
    zone_geometry           GEOMETRY(Polygon, 4326) NOT NULL,
    zone_name               VARCHAR(255),
    priority_level          VARCHAR(20) NOT NULL,
    total_score             DOUBLE PRECISION NOT NULL,
    severity_score          DOUBLE PRECISION,
    population_score        DOUBLE PRECISION,
    infrastructure_score    DOUBLE PRECISION,
    accessibility_score     DOUBLE PRECISION,
    factors_json            JSONB,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_priority_geom ON priority_scores USING GIST(zone_geometry);
CREATE INDEX IF NOT EXISTS idx_priority_level ON priority_scores(priority_level);


-- ============================================================
-- TABLE: routes
-- ============================================================
CREATE TABLE IF NOT EXISTS routes (
    id                      SERIAL PRIMARY KEY,
    scenario_id             INTEGER REFERENCES disaster_scenarios(id),
    origin_point            GEOMETRY(Point, 4326) NOT NULL,
    destination_point       GEOMETRY(Point, 4326) NOT NULL,
    route_geometry          GEOMETRY(LineString, 4326),
    distance_meters         DOUBLE PRECISION,
    estimated_time_minutes  DOUBLE PRECISION,
    blocked_roads_avoided   INTEGER DEFAULT 0,
    route_type              VARCHAR(50) DEFAULT 'suggested',
    calculation_time_ms     BIGINT,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_routes_geom ON routes USING GIST(route_geometry);


-- ============================================================
-- TABLE: model_evaluations
-- ============================================================
CREATE TABLE IF NOT EXISTS model_evaluations (
    id                      SERIAL PRIMARY KEY,
    model_version           VARCHAR(100) NOT NULL,
    dataset_name            VARCHAR(100),
    overall_accuracy        DOUBLE PRECISION,
    mean_iou                DOUBLE PRECISION,
    per_class_metrics       JSONB,
    confusion_matrix        JSONB,
    inference_time_avg_ms   DOUBLE PRECISION,
    total_samples           INTEGER,
    evaluated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- Done! Verify tables were created.
-- ============================================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
