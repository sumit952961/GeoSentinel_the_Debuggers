# 🌍 DRAS v2.0 — 3D Earth Tactical Operations Interface

## 1. Overview & Architecture

The **DRAS 3D Earth Tactical Interface** upgrades the Disaster Response & Assessment System from a conventional 2D web map into an immersive, high-performance geospatial tactical operations center. Combining the global scale of **CesiumJS (WebGL)** with the local cadastral precision of **Leaflet.js**, DRAS provides emergency commanders, civil defense officials, and field analysts with situational awareness across 4 distinct operational scenarios.

```
+---------------------------------------------------------------------------------------+
|                       DRAS DUAL-VIEWPORT PRESENTATION LAYER                           |
|                                                                                       |
|   +---------------------------------------+   +-----------------------------------+   |
|   |         CESIUMJS 3D EARTH GLOBE       |   |         LEAFLET 2D MAP            |   |
|   |  - Full WGS84 3D Globe & Terrain      |   |  - High-speed 2D tiled rendering  |   |
|   |  - 3D Extruded Building Footprints    |   |  - Traditional GIS pan/zoom       |   |
|   |  - Glowing Dual Route Corridors       |   |  - Low-bandwidth fallback         |   |
|   |  - Midpoint Blocked-Road Billboards   |   |  - Compact vector layer groups    |   |
|   |  - 3D Facility Pillars & Omni-Search  |   |  - Lightweight cadastral view     |   |
|   +---------------------------------------+   +-----------------------------------+   |
|                       ^                                   ^                           |
|                       |                                   |                           |
|                       +-----------------+-----------------+                           |
|                                         |                                             |
|                           [ 2D / 3D VIEWPORT SWITCHER ]                               |
|                     (Bidirectional Shared State Synchronization)                       |
|           • Scenario ID  • Selected Structure  • Route Data  • Filter State           |
+-----------------------------------------+---------------------------------------------+
                                          | HTTP REST (GeoJSON / JSON)
                                          v
+---------------------------------------------------------------------------------------+
|                    SPRING BOOT 3 (PORT 8081) & FASTAPI (PORT 8000)                    |
|   - /scenarios/{id}           - /map/damages           - /priorities/geojson          |
|   - /map/roads                - /map/hospitals         - /map/shelters                |
|   - /map/hazards              - /routes (Dijkstra)     - /analysis/{id}/summary       |
+---------------------------------------------------------------------------------------+
```

---

## 2. Key Capabilities & Tactical Visualizations

### 2.1 3D Extruded Building Damage Assessment
In 3D Earth mode, building footprints are extruded into volumetric 3D structures. The extrusion height and coloring directly reflect structural integrity and damage classification:

| Damage Class | Hex Code | Visual Styling | Extrusion Height Heuristic |
|:---|:---:|:---|:---|
| **No Damage** | `#10b981` | Emerald Green, solid | $8.0\text{ m} + \min(\text{area} \times 0.04, 12.0\text{ m})$ |
| **Minor Damage** | `#f59e0b` | Amber, solid | $6.0\text{ m} + \min(\text{area} \times 0.03, 8.0\text{ m})$ |
| **Major Damage** | `#f97316` | Orange, partial collapse | $3.5\text{ m} + \min(\text{area} \times 0.02, 5.0\text{ m})$ |
| **Destroyed** | `#ef4444` | Crimson Red, flattened rubble | $2.5\text{ m}$ (flat rubble footprint) |

> [!NOTE]
> **Photogrammetric Disclaimer**: Extrusion heights are computed using heuristic area-to-height scaling and damage-class collapse ratios. They provide operational visual stratification and are not surveyed LiDAR or stereo-photogrammetric ground truth heights.

#### Point-Observation Handling (Cyclone Fani)
In scenarios where building data consists of survey point observations rather than cadastral polygon boundaries (e.g. Cyclone Fani EMSR357 / OSDMA field records), structures are rendered as **3D vertical cylindrical marker columns** (5m radius, 18m height) topped with luminous sphere heads, avoiding erroneous planar polygon extrusion.

### 2.2 Critical Triage Elevation Offset
When the operator switches to **02 PRIORITISE** mode, buildings are re-colored by their 4-factor multi-attribute priority score:
$$\text{Priority} = 0.40S + 0.25P + 0.20I + 0.15A$$
- **CRITICAL (Score $\ge 0.70$)**: Elevated by an additional $+15\text{ m}$ with vertical reference lines to ensure instant identification in high-density urban rubble scenes.
- **HIGH (Score $0.50 - 0.69$)**: Elevated by $+8\text{ m}$.
- **MEDIUM / LOW**: Ground level.

### 2.3 Road Network & Blocked Corridors
- **Passable Roads**: Dark slate translucent ribbons conforming to 3D terrain.
- **Blocked Roads**: Rendered as glowing purple dashed corridors (`#7c3aed`, 6px width) with an upright **`⛔ BLOCKED`** 3D billboard pin anchored at the geometric midpoint.

### 2.4 Emergency Infrastructure Facilities
- **Hospitals (`🏥`)**: Blue 3D cylinder pedestals (14m radius, 25m height) with glowing cross billboards displaying facility name, emergency capacity, and casualty intake readiness.
- **Shelters (`⛺`)**: Emerald green 3D cylinder pedestals with tent billboards displaying shelter capacity and evacuee counts.

### 2.5 Hazard Footprints & Confluence Extents
Hazard zones (e.g., the 20.4 ha debris fan at Dharali, Chamoli glacial flash-flood gorge corridor, and Fani storm surge swath) are projected directly onto the 3D globe surface with red dashed hazard perimeter styling and translucent red ground draping.

### 2.6 Dual Glowing Route Corridors
When an emergency route is computed via Dijkstra with blocked-road avoidance, the path is rendered using Cesium's `PolylineGlowMaterialProperty`:
- **Response Access Route (`Staging → Site`)**: Glowing amber beam (`#f59e0b`, 7px width, 0.25 glow power) navigating emergency responders around debris hazards to the priority structure.
- **Evacuation Route (`Site → Facility`)**: Electric cyan beam (`#0284c7`, 7px width, 0.25 glow power) guiding casualties to the nearest available hospital or shelter.
- **Auto-Framing**: The Cesium camera automatically calculates a bounding sphere enclosing the entire route trajectory and flies smoothly to encompass the complete operational path.

---

## 3. Camera Dynamics & Navigation Controls

The Cesium camera system (`cameraService.js`) provides professional GIS and drone-like navigational capabilities:

1. **Initial Orbital Descent**: On initial load, the camera launches from high orbit ($15,000\text{ km}$ altitude) and performs a smooth 3.5-second curved descent into the target disaster scenario centroid.
2. **Smooth Scenario Fly-To**: Switching scenarios smoothly transitions the camera with optimal pitch ($-45^\circ$) and range tailored to the geographic extent.
3. **Structure Inspection Fly-To**: Clicking any building in the 3D viewport or search bar smoothly pitches the camera to $-60^\circ$ and focuses at $250\text{ m}$ altitude.
4. **2.5D / 3D Tilt Toggle**: Instantly toggles between an oblique perspective ($-45^\circ$ pitch) and a top-down orthographic nadir view ($-90^\circ$ pitch).
5. **Continuous 360° Orbit Mode**: Actively rotates the camera around the scenario focus point at $0.05^\circ/\text{frame}$, ideal for command center video wall displays.
6. **North Reset**: Resets camera heading to True North with zero roll.

---

## 4. Base Map, Terrain & Environment Configuration

Managed via `layerService.js`, the 3D viewport supports real-time environment switching:

### 4.1 Base Map Providers
- **Satellite (Default)**: High-resolution Esri World Imagery (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`). Completely free and tokenless.
- **Standard**: OpenStreetMap Standard cartographic tile layer.
- **Dark Matter**: CartoDB Dark Matter tiles optimized for nighttime operations and high-contrast glowing routes.

### 4.2 3D World Terrain & Token Fallback
- If a valid Cesium Ion Token is provided via `VITE_CESIUM_ION_TOKEN`, DRAS streams **Cesium World Terrain** with high-resolution global elevation data (including the Garhwal Himalayas and Uttarkashi valleys).
- If no token is provided, DRAS **automatically falls back** to the **WGS84 Standard Ellipsoid** with zero errors or broken tiles, ensuring the application remains 100% operational out of the box.

### 4.3 Solar Lighting (Day / Night / Auto)
- **Day Mode**: Fixed sun illumination for clear building and damage visibility.
- **Night Mode**: Fixed low-angle lighting emphasizing neon glowing routes and facility pins.
- **Auto Mode**: Real-time celestial lighting based on UTC time and scenario coordinates.

---

## 5. User Interface & Operations HUD

### 5.1 Presentation Mode (Fullscreen Command HUD)
Activating **Presentation Mode** (`CesiumControls.jsx`):
- Collapses the left controls panel and right details panel.
- Maximizes the 3D Earth canvas to 100% of the screen.
- Keeps tactical floating HUD elements accessible:
  - Top 2D/3D switcher pill.
  - Floating 3-step operational walkthrough (`01 ASSESS` $\rightarrow$ `02 PRIORITISE` $\rightarrow$ `03 RESPOND`).
  - Omni-Search bar.
  - Floating 3D Legend and status disclaimers.
- Clicking on a building or calculating a route automatically reveals the details panel.

### 5.2 Omni-Search Bar (`GlobeSearch.jsx`)
Provides instant autocomplete search across:
- All building structure IDs (`#1`, `#42`, etc.) with damage class indicators.
- Hospitals and emergency medical centers.
- Relief shelters and evacuation staging zones.
- Scenarios (Woolsey Fire, Chamoli, Cyclone Fani, Dharali).
Selecting any search result smoothly flies the 3D camera directly to the target.

### 5.3 Scenario-Specific Badges & Disclaimers
- **Woolsey Fire**: Prominently marked with `HISTORICAL DEMONSTRATION` badge.
- **Chamoli 2021**: Binary grading legend (`Intact` vs `Damaged/Obstructed`) reflecting EIDC ground survey protocols.
- **Cyclone Fani**: Point-observation legend reflecting EMSR357 / OSDMA field data.
- **Dharali 2025**: Persistent header banner explaining the qualitative zero-shot cross-event generalisation protocol and 20.4 ha debris fan overlay.

---

## 6. Bidirectional 2D $\leftrightarrow$ 3D State Synchronization

DRAS guarantees seamless state consistency when toggling between 2D Leaflet and 3D Cesium:

| State Variable | 2D Leaflet Behavior | 3D Cesium Earth Behavior | Synchronized via |
|:---|:---|:---|:---|
| **Selected Scenario** | Loads GeoJSON, fits bounds | Loads 3D Entities, flies camera | `selectedScenarioId` |
| **Selected Building** | White dashed ring highlight | Glowing 3D outline, camera zoom | `selectedBuilding` / `onSelectBuilding` |
| **Map Workflow Mode** | Recalls 2D layer styles | Updates 3D colors & elevations | `mapMode` (`DAMAGE`/`PRIORITY`/`ROUTING`) |
| **Active Route** | 2D Polyline with glow underlay | 3D Glowing Polyline Corridor | `activeRoute` / Dijkstra REST API |
| **Layer Toggles** | `L.LayerGroup.addTo/remove` | `CustomDataSource.show = bool` | `layers` state object |
| **Filter Sliders** | Re-filters GeoJSON features | Re-generates 3D entity collection | `damageFilter`, `priorityFilter`, `conf` |

When switching from 3D back to 2D, DRAS automatically calls `mapInstanceRef.current.invalidateSize()` after a 120ms debounce to prevent any tile graying or canvas distortion.

---

## 7. Environment Variables & Setup

Add to your `frontend/.env` or deployment environment:

```bash
# Optional: Cesium Ion token for high-resolution 3D world terrain
# If omitted or empty, DRAS defaults to free Esri Satellite tiles and WGS84 Ellipsoid
VITE_CESIUM_ION_TOKEN=

# Spring Boot API Gateway URL
VITE_API_URL=http://localhost:8081/api
```

### Installation
CesiumJS and the Vite plugin are included in the repository's `frontend/package.json`:
```bash
cd frontend
npm install
npm run build   # Verifies Cesium asset pipeline and WebGL shaders
npm run dev     # Launches DRAS at http://localhost:5173
```
