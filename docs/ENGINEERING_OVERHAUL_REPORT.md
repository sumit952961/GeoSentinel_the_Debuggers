# Disaster Response & Assessment System (DRAS v2.0) — Engineering Overhaul Report

## Executive Summary

The Disaster Response & Assessment System (DRAS) has undergone a comprehensive engineering overhaul across all four system tiers: **React 18 Frontend**, **Spring Boot 3.3.2 Backend**, **FastAPI PyTorch AI Service**, and **PostGIS 17 Geospatial Database**.

All identified runtime crashes, silent API failures, schema discrepancies, and 2D/3D visualization defects have been systematically fixed. Both the global benchmark (Woolsey Fire) and Indian scenarios (Chamoli Glacial Surge 2021, Cyclone Fani 2019, Dharali Cloudburst 2025) now load immediately, render high-contrast 2D/3D geospatial data, support bidirectional structure inspection with pre/post satellite evidence, and execute emergency evacuation and response routing around active roadblocks.

---

## 1. Key Bugs & Issues Resolved

### Frontend (React 18 / Vite / Leaflet / CesiumJS)
1. **`SystemHealth.jsx` Method Invocation Crash**:
   - *Problem*: Line 33 called `apiService.get('/health')`, but `apiService` is an object of named API functions while the default `api` export is the Axios instance with `.get()`. This caused backend status to perpetually report as `DOWN`.
   - *Resolution*: Replaced with `api.get('/health', { timeout: 3000 })` and implemented safe AbortController timeout handling for the AI microservice.
2. **`ExecutiveDashboard.jsx` Fake Fallbacks & Undefined Properties**:
   - *Problem*: Critical/High/Medium/Low priority counts used `|| 2`, `|| 61`, `|| 66`, fabricating numbers whenever true counts were 0. Additionally, `{BRANDING.SCENARIO_BADGE}` evaluated to `undefined`.
   - *Resolution*: Removed synthetic falsy fallbacks to display true calculated counts and added scenario-aware badge resolution.
3. **`CesiumGlobe.jsx` MultiPolygon Coordinate Extraction Crash**:
   - *Problem*: Direct indexing `coords[0][0][0]` on `MultiPolygon` geometries returned arrays rather than scalar longitude numbers, producing `NaN` in camera flight functions and crashing the 3D globe click handler.
   - *Resolution*: Built a recursive coordinate traversal engine that extracts true geometric centroids for any geometry (`Point`, `Polygon`, `MultiPolygon`).
4. **`DisasterMap.jsx` Route Calculation Centroid Crash**:
   - *Problem*: Lines 789–798 performed naive ring indexing for route origins, failing on complex and multi-part building polygons.
   - *Resolution*: Applied robust centroid extraction across all footprint geometries.
5. **Interactive Footprints Layer**:
   - *Problem*: Ground truth footprints layer (`layers.buildings`) lacked an `onEachFeature` handler, making footprints non-clickable.
   - *Resolution*: Added hover and click listeners that select structures and open the inspection drawer.
6. **2D Satellite Basemap Toggle**:
   - *Problem*: 2D map was hardcoded to OpenStreetMap tiles with no satellite basemap option.
   - *Resolution*: Implemented dynamic tile switching between **Esri World Imagery (Satellite)**, **OpenStreetMap (Standard)**, and **CARTO (Dark Matter)** with a floating HUD selector pill.
7. **First-Class Indian Scenario Default**:
   - *Problem*: System initialized to California (Woolsey Fire) with Leaflet map centered on Los Angeles `[34.0522, -118.6850]`.
   - *Resolution*: Updated default scenario selection and Leaflet initial coordinates to **Chamoli, Uttarakhand `[30.4400, 79.6200]`**.
8. **3D Cesium Route Display Bug**:
   - *Problem*: `convertRouteTo3DEntities` in `cesiumAdapter.js` accessed `activeRoute.routeGeoJson.coordinates`, but the backend returns a GeoJSON Feature where coordinates are located at `activeRoute.routeGeoJson.geometry.coordinates`. The route never appeared in 3D.
   - *Resolution*: Fixed property traversal to check `geometry.coordinates`, rendering glowing 3D clamped routes with camera auto-framing.
9. **Missing React Router Routes**:
   - *Problem*: Direct navigation to `/map`, `/dashboard`, and `/reports` redirected to root `/` because only parameterized paths existed.
   - *Resolution*: Added top-level routes for `/map`, `/dashboard`, `/reports`, and raw data inspection `/scenario-data`.
10. **Landing Page Dynamic KPIs**:
    - *Problem*: Landing page displayed static hardcoded KPI values (e.g., `1845` buildings, `342` critical).
    - *Resolution*: Made KPIs dynamically aggregate real building counts, facility counts, and road networks directly from the scenarios API.

---

### Backend (Spring Boot 3.3.2 / Hibernate Spatial / JTS)
1. **GeoJSON Prediction Import Drop Bug**:
   - *Problem*: In `GeoJsonFeature.java`, `jtsGeometry` was marked `@JsonIgnore` with no JSON setter. When GeoJSON was POSTed to `/api/analysis/{scenarioId}/import-predictions`, Jackson ignored the geometry, causing `AnalysisService` to drop 100% of imported predictions.
   - *Resolution*: Added `@JsonProperty("geometry") public void setGeometryNode(JsonNode node)` utilizing JTS `GeoJsonReader` to parse geometries and enforce SRID 4326.
2. **JTS `GeoJsonReader` SRID 0 Mismatch**:
   - *Problem*: `JacksonGeoConfig.java` parsed geometries with default SRID `0`, which caused PostgreSQL to reject spatial inserts on columns defined as `geometry(..., 4326)`.
   - *Resolution*: Explicitly set `geom.setSRID(4326)` on all deserialized geometry instances.
3. **Missing Hazard Proximity JPA Fields**:
   - *Problem*: Migration scripts added `hazard_proximity_score` and `weight_hazard_proximity` columns to `priority_assessments`, but `PriorityAssessment.java` lacked these fields.
   - *Resolution*: Added fields, getters, setters, and mapped them in `PriorityService.getPrioritiesGeoJson`.
4. **`ClassCastException` in RouteService**:
   - *Problem*: `entity.setBlockedRoadsAvoidedCount((Integer) props.get("avoided_blockage_count"))` threw runtime exceptions when the integer was parsed as Long or Number.
   - *Resolution*: Safe conversion via `((Number) props.get("avoided_blockage_count")).intValue()`.

---

### AI Service (FastAPI / PyTorch / NetworkX)
1. **DDL Mismatch in `priority_engine.py`**:
   - *Problem*: Table creation DDL omitted `hazard_proximity_score` and `weight_hazard_proximity`, but the subsequent `INSERT` query required them, causing crashes on fresh table setup.
   - *Resolution*: Added columns to the `CREATE TABLE` statement along with idempotent `ALTER TABLE` statements.
2. **Universal Image Pair Locator**:
   - *Problem*: `/api/cv/predict-pair` had hardcoded paths to `data/xbd_subset_v2`, causing 404 errors on Indian disaster events.
   - *Resolution*: Implemented `locate_image_pair(pair_id)` scanning xBD subsets, scenario-specific Indian subdirectories (`chamoli_2021`, `fani_2019`, `dharali_2025`), and recursive fallback.
3. **EPSG:4326 Geographic Coordinate Projection**:
   - *Problem*: Two-stage pipeline returned raw pixel coordinates rather than latitude/longitude.
   - *Resolution*: Integrated affine Ground Sampling Distance projection in `TwoStageDisasterPipeline.predict_pair` to convert pixels into WGS84 GPS coordinates based on scenario reference anchors.
4. **Recursive Model Health Reporting**:
   - *Problem*: `/model/info` scanned only top-level `.pth` files in `ai-service/models/`.
   - *Resolution*: Recursively scans both `ai-service/models/` and root `models/` for both `.pth` and `.pt` checkpoints, reporting active architectures.

---

### Database (PostgreSQL 17 / PostGIS)
1. **Self-Intersecting Invalid Geometries Fixed**:
   - Executed `ST_GeometryN(ST_CollectionExtract(ST_MakeValid(geometry), 3), 1)` across `buildings`, `damage_predictions`, and `priority_assessments`.
   - **Result**: 100% of geometries across all tables now pass `ST_IsValid(geometry) = true`.

---

## 2. Verification & Test Results

### A. All-Scenario End-to-End Suite (`scripts/run_all_scenarios_e2e.py`)
```
================================================================================
DRAS v2.0 ALL-SCENARIO END-TO-END VALIDATION (INDIA & GLOBAL)
================================================================================

--- Testing Scenario 1: Woolsey Fire 2018 (California, USA) ---
  [PASS] Scenario metadata: 2018 Southern California Wildfire (Woolsey Fire)
  [PASS] Buildings: 181 footprints loaded (Geometry type: Polygon)
  [PASS] Damages: 181 predictions with softmax probabilities
  [PASS] Priorities: 181 triage assessments with multi-factor breakdown
  [PASS] Roads: 8 segments (4 blocked / hazard corridors)
  [PASS] Facilities: 7 Hospitals, 6 Relief Shelters
  [PASS] Operational Zones: 4 macro sectors delineated
  [PASS] Evacuation Route: Target -> 'Malibu Urgent Care Center' | Dist: 9.85km | Time: 14.8min (123.6ms)

--- Testing Scenario 2: Chamoli Flash Flood 2021 (Uttarakhand, India) ---
  [PASS] Scenario metadata: Chamoli Flash Flood 2021 (Uttarakhand, India)
  [PASS] Buildings: 45 footprints loaded (Geometry type: Polygon)
  [PASS] Damages: 45 predictions with softmax probabilities
  [PASS] Priorities: 45 triage assessments with multi-factor breakdown
  [PASS] Roads: 6 segments (1 blocked / hazard corridors)
  [PASS] Facilities: 3 Hospitals, 2 Relief Shelters
  [PASS] Operational Zones: 4 macro sectors delineated
  [PASS] Evacuation Route: Target -> 'CHC Joshimath' | Dist: 17.06km | Time: 25.6min (113.1ms)

--- Testing Scenario 3: Cyclone Fani 2019 (Odisha, India) ---
  [PASS] Scenario metadata: Cyclone Fani 2019 (Odisha, India)
  [PASS] Buildings: 60 footprints loaded (Geometry type: Polygon)
  [PASS] Damages: 60 predictions with softmax probabilities
  [PASS] Priorities: 60 triage assessments with multi-factor breakdown
  [PASS] Roads: 7 segments (1 blocked / hazard corridors)
  [PASS] Facilities: 3 Hospitals, 3 Relief Shelters
  [PASS] Operational Zones: 4 macro sectors delineated
  [PASS] Evacuation Route: Target -> 'District Headquarters Hospital Puri' | Dist: 1.24km | Time: 1.9min (107.1ms)

--- Testing Scenario 4: Dharali Flash Flood 2025 (Uttarakhand, India) ---
  [PASS] Scenario metadata: Dharali Flash Flood 2025 (Uttarakhand, India)
  [PASS] Buildings: 30 footprints loaded (Geometry type: Polygon)
  [PASS] Damages: 30 predictions with softmax probabilities
  [PASS] Priorities: 30 triage assessments with multi-factor breakdown
  [PASS] Roads: 4 segments (1 blocked / hazard corridors)
  [PASS] Facilities: 2 Hospitals, 2 Relief Shelters
  [PASS] Operational Zones: 4 macro sectors delineated
  [PASS] Evacuation Route: Target -> 'District Hospital Uttarkashi' | Dist: 45.5km | Time: 68.2min (229.0ms)

================================================================================
FINAL RESULT: 4/4 SCENARIOS FULLY OPERATIONAL AND VERIFIED
================================================================================
```

### B. System Integration Suite (`scripts/run_final_end_to_end_test.py`)
- **10/10 Tests Passed (100% Success Rate)**
  - Spring Boot Backend (Port 8081): UP
  - FastAPI AI Service (Port 8000): UP
  - Scenario Retrieval: PASS
  - Damage Predictions: PASS (181 polygons with softmax distributions)
  - Priority Rankings: PASS (181 locations with explainable formula)
  - Road Infrastructure: PASS (8 corridors, 4 blocked)
  - Facilities: PASS (7 Hospitals, 6 Shelters)
  - Response Route: PASS (Staging Base -> Target, 4.67km, 4 roadblocks avoided)
  - Evacuation Route: PASS (Target -> Malibu Urgent Care Center, 3.4km, 5.1min)
  - Spatial Summary KPIs: PASS

### C. Scientific & Operational Audit (`scripts/validate_system_scenarios.py`)
- **Verdict**: `[SUCCESS] All 4 Scenarios Passed 100% Operational & Scientific Integrity Checks!`
- **Dual Satellite Evidence**: All 4 scenarios verified present on disk.
- **Building Dual-Crops**: 32/32 pre/post chips verified present.
- **Model Checkpoints**: India v2, India v3 Stage 1, and India v3 Stage 2 verified present.

---

## 3. Operational Service Endpoints

| Tier | Service | Port | Endpoint | Status |
|---|---|---|---|---|
| Frontend | React 18 / Vite Dev Server | `5173` | `http://localhost:5173/` | ACTIVE |
| Backend | Spring Boot REST API | `8081` | `http://localhost:8081/api/health` | ACTIVE |
| AI Microservice | FastAPI / PyTorch | `8000` | `http://localhost:8000/health` | ACTIVE |
| Database | PostgreSQL 17 / PostGIS | `5432` | `localhost:5432/disaster_db` | ACTIVE |
