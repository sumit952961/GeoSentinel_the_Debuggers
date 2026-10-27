# 🏗️ System Architecture & Design Document

## 1. Overview

The **Disaster Management Decision-Support Platform** is an integrated full-stack geospatial system designed for disaster response operations. It operates entirely on local commodity hardware (CPU-only, zero recurring software license cost) while delivering sub-second spatial queries, computer vision damage assessments, and emergency routing calculations.

```
+-------------------------------------------------------------------------+
|                    PRESENTATION LAYER (React 19 + Leaflet)              |
|   - Interactive Disaster Operations Map (Leaflet.js + GeoJSON layers)   |
|   - Priority Ranking & Multi-Factor Triage Explainability Panel         |
|   - Emergency Evacuation Route Planner (Dijkstra Detour Display)        |
|   - Executive KPI Dashboard & Scientific Model Evaluation Metrics       |
+------------------------------------+------------------------------------+
                                     | JSON / GeoJSON (HTTP REST)
                                     v
+-------------------------------------------------------------------------+
|              API GATEWAY & BUSINESS LOGIC (Spring Boot 3 / Java 24)     |
|   - ScenarioController: Disaster scenario lifecycle & boundaries        |
|   - MapLayerController: PostGIS JTS GeoJSON feature serialization       |
|   - PriorityController: Multi-factor triage scoring & breakdown APIs    |
|   - RouteController: Emergency route calculation & PostGIS persistence  |
|   - AnalysisController: Real-time disaster KPI summaries & CSV/GeoJSON  |
+-------------------+---------------------------------+-------------------+
                    | JDBC / Hibernate Spatial        | HTTP REST (JSON)
                    v                                 v
+-------------------------------------+ +---------------------------------+
|      SPATIAL DATABASE LAYER         | |       AI & ROUTING SERVICE      |
|    (PostgreSQL 17 + PostGIS)        | |         (Python FastAPI)        |
| - disaster_scenarios (SRID 4326)    | | - Stage 1: U-Net ResNet34 (CV)  |
| - damage_predictions (Polygons)     | | - Stage 2: Siamese ResNet18     |
| - buildings (Ground Truth)          | | - Priority Scoring Engine       |
| - roads (LineStrings + blockages)   | | - NetworkX Graph Router         |
| - hospitals & shelters (Points)     | | - Haversine Distance Engine     |
| - priority_assessments & routes     | +---------------------------------+
+-------------------------------------+
```

---

## 2. Component Details

### A. Frontend (React 19 + Leaflet)
- **Port**: `5173` (Vite)
- **Map Engine**: Leaflet 1.9 with OpenStreetMap tile layer (no paid API tokens required).
- **Styling**: Modern, responsive CSS design system with curated HSL color palettes and clear visual hierarchy.
- **Key Modules**:
  - `DisasterMap.jsx`: Main operations view with layer toggles, severity filters, confidence threshold sliders, triage popups, and routing controls.
  - `ExecutiveDashboard.jsx`: High-level summary of total affected structures, critical priority counts, and active emergency facility capacities.
  - `ResearchMetrics.jsx`: Empirical benchmark reporting for Stage 1 and Stage 2 models.
  - `SystemHealth.jsx`: Real-time operational diagnostics across all 4 subsystems.

### B. Backend (Spring Boot 3 / Java 24)
- **Port**: `8081`
- **Spatial Framework**: Hibernate Spatial 6 + JTS (Java Topology Suite).
- **GeoJSON Serialization**: Custom Jackson JTS serializers outputting WGS84 (EPSG:4326) GeoJSON `FeatureCollection` objects.
- **Data Access**: Spring Data JPA repositories with custom spatial queries and GiST indexing.

### C. AI & Routing Microservice (Python FastAPI)
- **Port**: `8000`
- **Deep Learning Framework**: PyTorch 2.6.0 (CPU FP32 inference).
- **Stage 1 Model**: U-Net with ResNet34 encoder (24.4M parameters).
- **Stage 2 Model**: Siamese ResNet18 with 3-branch feature fusion (12.0M parameters).
- **Graph Routing**: NetworkX 3.5 graph with Dijkstra shortest path and configurable road blockage penalties ($10^6 \times \text{cost}$).

### D. Spatial Database (PostgreSQL 17 + PostGIS)
- **Port**: `5432`
- **Coordinate Reference System**: Standard WGS84 (EPSG:4326) `[Longitude, Latitude]`.
- **Spatial Indexing**: GiST indexes on all geometry columns ensuring sub-millisecond spatial bounding box and nearest-neighbor lookups.

---

## 3. Data Flow

1. **AI Ingestion**: Pre- and post-disaster satellite imagery $\rightarrow$ Stage 1 localization $\rightarrow$ Stage 2 damage classification $\rightarrow$ GeoJSON polygons stored in `damage_predictions`.
2. **Priority Assessment**: PostGIS damage records $\rightarrow$ Priority Engine combines Severity, Footprint Population Proxy, Facility Proximity, and Road Access $\rightarrow$ Saved to `priority_assessments`.
3. **Map Visualization**: React frontend fetches GeoJSON layers from Spring Boot REST endpoints $\rightarrow$ Renders interactive vector polygons, lines, and point markers.
4. **Evacuation Routing**: User selects high-priority building $\rightarrow$ Requests route to nearest operational hospital/shelter $\rightarrow$ FastAPI builds NetworkX road graph, detours around blocked roads via Dijkstra $\rightarrow$ Spring Boot saves LineString geometry to `evacuation_routes` $\rightarrow$ Displayed on map.
