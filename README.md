# 🛰️ GeoSentinel — AI-Powered Geospatial Disaster Response & Emergency Command System

<div align="center">

**Developed by Team: The Debuggers**

[![Architecture: Geospatial AI](https://img.shields.io/badge/Architecture-Geospatial%20AI-0284c7.svg?style=for-the-badge)](#-system-architecture--data-flow)
[![Stack: React 19 + Spring Boot 3 + FastAPI](https://img.shields.io/badge/Stack-React%2019%20%7C%20Spring%20Boot%203%20%7C%20FastAPI-10b981.svg?style=for-the-badge)](#-technology-stack)
[![Database: PostgreSQL 17 + PostGIS 3.5](https://img.shields.io/badge/Database-PostgreSQL%2017%20%2B%20PostGIS%203.5-6366f1.svg?style=for-the-badge)](#-database--spatial-indexing)
[![Standards: OASIS CAP v1.2 & FEMA NIMS](https://img.shields.io/badge/Standards-OASIS%20CAP%20v1.2%20%7C%20FEMA%20NIMS-ea580c.svg?style=for-the-badge)](#-standards-compliance--alerting)
[![Verification: 68/68 E2E Tests Passing](https://img.shields.io/badge/Verification-68%2F68%20E2E%20Tests%20Passing-059669.svg?style=for-the-badge)](#-automated-verification--testing)

*An end-to-end Geospatial AI and Command-and-Control (C2) platform integrating multi-temporal satellite Computer Vision, 2D/3D Digital Twin visualization, Explainable Priority Triage, Hazard-Aware Dual Routing, OASIS CAP v1.2 Emergency Alerting, and FEMA NIMS/ICS Computer-Aided Dispatch (CAD).*

</div>

---

## 📌 1. Executive Summary & Problem Statement

During acute natural hazards (wildfires, glacial flash floods, tropical cyclones, cloudburst debris flows), emergency response operations encounter fatal bottlenecks:
1. **Prolonged Damage Assessment**: Traditional aerial and ground photo-interpretation takes days or weeks, stalling immediate search-and-rescue during the critical golden 72 hours.
2. **Severe Spatial Class Imbalance**: Undamaged background structures heavily outnumber collapsed structures ($>38:1$ in general, $>199:1$ in steep mountain corridors), causing standard segmentation architectures to collapse to trivial majority prediction.
3. **Black-Box Triage**: Triage algorithms produce opaque numbers without explainable breakdown for Incident Commanders managing finite field resources.
4. **Impaired Navigation**: Standard mapping engines route first responders directly through impassable floodplains, debris fans, or structurally compromised road segments.
5. **Disconnected Alerting & Dispatch**: Structural assessments rarely bridge directly to standardized public early warning protocols (OASIS CAP v1.2) or real-time first responder CAD dispatch boards.

---

## 💡 2. The GeoSentinel Solution

**GeoSentinel** resolves these bottlenecks across an integrated six-pillar workflow:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   GEOSENTINEL PIPELINE                                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
 [Satellite Ingestion]       [AI Damage Triage]           [Spatial Aggregation]
  • Maxar WorldView VHR       • Stage 1: Settlement U-Net  • Minor-Level Structured Sectors
  • Sentinel-2 L2A Multispec  • Stage 2: Structural Cond.  • Apex Rescue Target Id
  • ISRO Cartosat & Bhuvan    • 5-Factor Triage Engine     • Pop Exposure & Risk Metrics
            │                           │                              │
            ▼                           ▼                              ▼
 [Dual Digital Twin Map]     [Hazard Dual Routing]        [Alert & Emergency CAD]
  • 2D Leaflet Tactical Map   • NetworkX Graph Engine      • OASIS CAP v1.2 XML Broadcast
  • 3D Cesium Earth Globe     • Dijkstra Hazard Detours    • FEMA NIMS/ICS Unit Dispatch
  • High-Contrast Overlays    • EOC Access vs Evacuation   • Civilian SOS & Distress Siren
```

1. **Two-Stage Decoupled Computer Vision Pipeline**: Decouples building footprint boundary localization from structural damage grading, eliminating background collapse on 10m multispectral imagery.
2. **Dual Digital Twin (2D Tactical & 3D Earth)**: Instant switching between a 3-column Leaflet operations map and an immersive CesiumJS 3D digital twin with non-overlapping structured operational zones.
3. **5-Factor Explainable Priority Triage**: Transparent triage score decomposition across Structural Severity ($35\%$), Population Exposure ($20\%$), Infrastructure Proximity ($20\%$), Accessibility ($15\%$), and Active Hazard Proximity ($10\%$).
4. **Hazard-Aware Dual Routing Engine**: Instant ($<20\text{ ms}$) NetworkX Dijkstra route calculation for both **Response Access** (Staging Base $\rightarrow$ Target) and **Civilian Evacuation** (Target $\rightarrow$ Hospital / Shelter), enforcing dynamic detours around blocked roads and hazard polygons.
5. **OASIS Common Alerting Protocol (CAP v1.2) System**: Generates international XML alerts with polygon geocodes, severity/urgency classifications, and multi-channel public dissemination instructions (Cell Broadcast, EAS, Sirens, Radio).
6. **FEMA NIMS/ICS Computer-Aided Dispatch (CAD)**: Real-time incident intake queue, first-responder unit allocation state machine (`AVAILABLE` $\rightarrow$ `DISPATCHED` $\rightarrow$ `ON_SCENE` $\rightarrow$ `RETURNING`), civilian SOS intake, and Web Audio distress siren telemetry.

---

## 🗺️ 3. Evaluated Disaster Scenarios

GeoSentinel is rigorously benchmarked across 4 real-world disaster scenarios spanning supervised benchmarks, native ground truth, surveyed points, and zero-shot transfer:

| Scenario | Disaster Type | Location | Imagery / Sensor Data | Footprint Geometry | Benchmark Status |
|---|---|---|---|:--:|---|
| **Woolsey Fire (2018)** | Wildfire | California, USA | Maxar WorldView-2/3 (0.5m VHR) | Polygon | Standard Supervised Benchmark (xBD) |
| **Chamoli Flash Flood (2021)** | Glacial Surge / Flood | Uttarakhand, India | Copernicus Sentinel-2 L2A (10m) + NERC EIDC | Polygon | Verified Ground Truth (6,455 native footprints) |
| **Cyclone Fani (2019)** | Tropical Cyclone | Odisha, India | Copernicus Sentinel-2 L2A (10m) + EMSR357 | Point | Expert Point Grading (9,777 surveyed points) |
| **Dharali Flash Flood (2025)** | Cloudburst / Debris Fan | Uttarakhand, India | Sentinel-2 L2A + ISRO Cartosat-2S & Bhuvan | Polygon | Qualitative Zero-Shot Transfer (20.4 ha debris extent) |

---

## 🏗️ 4. System Architecture & Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER (React 19 + Vite)                          │
│  - Port 5173                                                                     │
│  - Operations Map: 2D Leaflet + 3D CesiumJS Digital Twin                         │
│  - Emergency CAD Board: Unit Dispatch, Incident Queue, Siren Audio Engine        │
│  - Incident Executive Dashboard & Research Empirical Benchmark Visualizer        │
│  - Standardized Navigation & Theme Context (Dark / Light Tokens)                 │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ HTTP REST (JSON / GeoJSON / OASIS XML)
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                 APPLICATION BACKEND (Spring Boot 3.4 / Java 24)                  │
│  - Port 8081                                                                     │
│  - ScenarioController, MapLayerController, PriorityController, RouteController   │
│  - EmergencyResponseController: OASIS CAP 1.2 XML Generator, CAD State Machine   │
│  - Hibernate Spatial (PostGIS EPSG:4326 Mapping & Jackson GeoJSON Serialization) │
│  - Spring WebClient Microservice Gateway                                         │
└─────────────────────┬────────────────────────────────────┬───────────────────────┘
                      │ Spatial SQL (JDBC)                 │ HTTP REST
                      ▼                                    ▼
┌────────────────────────────────────────┐  ┌──────────────────────────────────────┐
│   SPATIAL DATABASE (PostgreSQL 17)     │  │   AI MODEL & ROUTING MICROSERVICE    │
│  - PostGIS 3.5 Spatial Extension       │  │   (FastAPI / Python 3.12)            │
│  - disaster_scenarios                  │  │  - Port 8000                         │
│  - damage_predictions                  │  │  - Stage 1: U-Net ResNet34           │
│  - buildings, hazard_zones             │  │  - Stage 2: Structural Condition     │
│  - operational_zones (Minor Level)     │  │  - 5-Factor Priority Decision Engine │
│  - roads (with blockage flags)         │  │  - NetworkX Dijkstra Hazard Router   │
│  - hospitals, relief_shelters          │  │  - Model Version Registry            │
│  - cap_alerts, response_units          │  └──────────────────────────────────────┘
│  - cad_incidents                       │
└────────────────────────────────────────┘
```

---

## 💻 5. Technology Stack

| Layer | Technologies | Role / Purpose |
|---|---|---|
| **Frontend** | React 19, Vite, Leaflet.js, CesiumJS, Axios, React Router 7, Lucide Icons, Web Audio API | 2D/3D map visualization, CAD dispatch console, audio distress siren, theme token system |
| **Backend API** | Spring Boot 3.4, Java 24, Spring Data JPA, Hibernate Spatial, JTS Topology Suite | Mission-critical REST API, OASIS CAP 1.2 XML serializer, CAD dispatch state machine |
| **Model & Routing** | FastAPI, Uvicorn, PyTorch 2.6, Segmentation Models PyTorch, OpenCV, NetworkX 3.4, Shapely | Stage 1 settlement segmentation, Stage 2 damage grading, 5-factor triage, graph router |
| **Spatial Database** | PostgreSQL 17, PostGIS 3.5 | Spatial GiST indexing, ST_Contains/ST_Distance queries, spatial clustering, zone topology |
| **GIS Imagery** | Copernicus Sentinel-2, Maxar Open Data, ISRO Bhuvan, OpenStreetMap | Multi-spectral bands, high-resolution base layers, open road vectors |

---

## 🧠 6. Computer Vision Architecture & Empirical Benchmarks

### Two-Stage Decoupled Model Pipeline
Single-stage semantic segmentation collapsed when applied to 10m Sentinel-2 satellite tiles due to $>99.5\%$ background dominance. GeoSentinel decouples localization from condition grading:

```
[Pre-Disaster Satellite Tile] ──┐
                                ├──▶ [Stage 1: Binary Localization U-Net] ──▶ [Settlement Mask]
[Post-Disaster Satellite Tile] ─┘      (97.70% Pixel Acc / 83.13% Bal Acc)            │
                                                                                       ▼
                                                                       [Extracted Building Crops]
                                                                                       │
[Pre Crop / Feature Vector]  ──┐                                                       ▼
                               ├──▶ [Stage 2: Structural Condition Classifier] ──▶ [Damage State]
[Post Crop / Feature Vector] ─┘      (Evaluated on Verified Footprints)           (Softmax Distribution)
```

### Empirical Results Across 5 Experiments

| Experiment | Configuration | Raw Accuracy | Balanced Accuracy | Macro F1 | Damaged-Class Recall | Status |
|---|---|:--:|:--:|:--:|:--:|---|
| **Exp 0** | Baseline (xBD Pretrained Weights, U-Net ResNet34) | 15.91% | 27.39% | 9.45% | 0.08% | Zero-shot baseline on 10m Sentinel-2 tiles |
| **Exp 1** | India-Tuned v1 (Unweighted Cross-Entropy) | 15.39% | 26.60% | 8.54% | 0.19% | Trivial collapse to background |
| **Exp 2** | India-Tuned v2 (Class-Weighted Loss) | 19.21% | 26.77% | 7.94% | 0.71% | Operational checkpoint (+3.30 pp gain) |
| **Exp 3a** | Stage 1 Decoupled Building Localization | **97.70%** | **83.13%** | **59.95%** | **68.42%** | Settlement cluster segmentation against terrain |
| **Exp 3b** | Stage 2 Chamoli Native Footprints (6,455 polygons) | **92.03%** | **83.56%** | **52.20%** | **75.00% (24/32)** | Native condition grading (Intact vs Damaged) |
| **Exp 3c** | Stage 2 Chamoli Manual Subset (166 buildings) | **94.58%** | **91.18%** | **90.81%** | **100.00%** | 3 represented classes |
| **Exp 3d** | Stage 2 Cyclone Fani Point Grading (9,777 points) | **82.35%** | **59.00%** | **60.26%** | **92.90%** | Expert surveyed points (OSDMA / EMSR357) |

> [!NOTE]
> **The Accuracy Paradox Disclosed**: In the Chamoli ground truth, $6,389$ of $6,455$ buildings ($98.98\%$) are intact. A naive model predicting "intact" everywhere achieves **98.98% accuracy but 0% damaged recall**. GeoSentinel honestly reports real empirical metrics: **92.03% accuracy, 83.56% balanced accuracy, and 75.00% damaged recall (24 of 32 damaged structures detected)**.

---

## 🚨 7. Explainable 5-Factor Priority Triage

GeoSentinel calculates an explainable priority index ($0.0 - 1.0$) for every affected structure:

$$\text{Priority Score} = w_S \cdot S + w_P \cdot P + w_I \cdot I + w_A \cdot A + w_H \cdot H$$

- **Structural Severity ($S$, 35%)**: Direct damage classification score ($\text{Destroyed}=1.0, \text{Major}=0.75, \text{Minor}=0.40, \text{No-Damage}=0.0$).
- **Population Exposure ($P$, 20%)**: Building footprint surface area proxy scaled to estimated residential occupancy.
- **Critical Infrastructure Proximity ($I$, 20%)**: Inverse spatial distance to nearest operational hospital or relief shelter.
- **Accessibility Impairment ($A$, 15%)**: Network penalty based on adjacent blocked or hazardous road corridors.
- **Hazard Zone Proximity ($H$, 10%)**: Spatial intersection or distance to active debris fan, flood surge corridor, or fire perimeter.

**Triage Urgency Tiers**: `CRITICAL` ($\ge 70\%$), `HIGH` ($50\% - 69\%$), `MEDIUM` ($30\% - 49\%$), `LOW` ($< 30\%$).

---

## 🧭 8. Operational Sectors & Hazard-Aware Dual Routing

- **Minor-Level Structured Sectors**: Spatially contiguous, non-overlapping operational zones aggregated via spatial clustering. Each sector presents total building counts, destroyed counts, exposed population, zone criticality, and apex rescue targets.
- **Dual Routing Workflows**:
  - **01 Response Access**: Navigates first responders from the incident Staging Base / Incident Command Post (ICP) to the designated priority target.
  - **02 Civilian Evacuation**: Navigates casualties or evacuees from the affected site to the nearest operational hospital or relief shelter.
- **Dynamic Hazard Detours**: NetworkX road graphs assign an impenetrable penalty ($10^6\times$) to blocked road segments or active hazard perimeters, computing clear alternate detours in $<20\text{ ms}$.

---

## 📡 9. Standards Compliance: Alerting & CAD Emergency Dispatch

### OASIS Common Alerting Protocol (CAP v1.2)
GeoSentinel integrates international alerting standards compliant with OASIS CAP v1.2, ITU-T X.1303, and WMO Early Warnings for All (EW4All):
- **Automated CAP Generation**: Instantly compiles sector criticality and hazard envelopes into valid OASIS CAP XML.
- **Multi-Channel Distribution**: Dissemination templates for Cell Broadcast (WEA/EU-Alert), Emergency Alert System (EAS), Siren Networks, and CAP-RSS feeds.
- **Geocoding**: Embeds explicit WGS-84 polygon coordinate rings for geographic targeting.

### FEMA NIMS / ICS-Compliant Computer-Aided Dispatch (CAD)
- **CAD Board UI**: Real-time operational incident intake, telemetry monitoring, and resource tracking (`/scenario/:id/emergency`).
- **Responder Unit State Machine**: State transitions (`AVAILABLE` $\rightarrow$ `DISPATCHED` $\rightarrow$ `ON_SCENE` $\rightarrow$ `RETURNING`) with designated unit types (USAR Heavy Urban Search & Rescue, Medevac Mobile ICU, Wildfire Suppression, Police Evacuation, Thermal Drone Recon).
- **Distress Siren Engine**: Synthesizes 500Hz/850Hz dual-frequency oscillating distress audio directly via the browser's Web Audio API.

---

## ⚡ 10. Local Setup & Quickstart

### Prerequisites
- **Java 17+ or Java 24**
- **Node.js 18+** & `npm`
- **Python 3.10+ / 3.12**
- **PostgreSQL 15+ / 17** with **PostGIS** extension

### 1. Database Setup
```sql
CREATE DATABASE disaster_db;
\c disaster_db;
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Start AI Model & Routing Service (Port 8000)
```bash
cd ai-service
# On Windows:
python -m venv venv
venv\Scripts\activate
# On Linux/macOS:
python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 4. Start Spring Boot REST Backend (Port 8081)
```bash
cd backend
# On Windows:
.\mvnw.cmd spring-boot:run
# On Linux/macOS:
./mvnw spring-boot:run
```

### 5. Start React 19 Frontend (Port 5173)
```bash
cd frontend
npm install
npm run dev
```

Visit **http://localhost:5173** to access the operations console.

---

## 🧪 11. Automated Verification & Testing

GeoSentinel includes an end-to-end automated testing suite verifying all backend endpoints, spatial queries, routing cases, and alert generators:

```bash
# Run complete system E2E test suite
python scripts/run_e2e_test.py
```

**Verification Coverage**:
- Backend Health (`:8081`) & AI Service Health (`:8000`)
- 4 Scenario Spatial Layers (Damages, Buildings, Roads, Hospitals, Shelters, Zones, Hazards)
- Dual Routing Engine (Response Access & Evacuation Paths)
- Priority Assessment Integrity & Executive Report Generation
- OASIS CAP 1.2 XML serialization & CAD dispatch state machine
- Negative boundary test cases (404s, invalid coordinates, missing IDs)

---

## 📁 12. Repository Structure

```
GeoSentinel_the_Debuggers/
├── README.md                           # Comprehensive documentation & architecture guide
├── ai-service/                         # FastAPI Computer Vision & Routing Microservice
│   ├── app/
│   │   ├── analysis/                   # 5-factor priority engine & operational zone generator
│   │   ├── api/                        # REST endpoints (CV inference, routing, metrics, health)
│   │   ├── cv/                         # Stage 1 U-Net, Stage 2 Siamese classifier, loss functions
│   │   └── routing/                    # NetworkX Dijkstra hazard router
│   ├── outputs/                        # Empirical evaluation JSONs & confusion matrices
│   └── requirements.txt                # Python dependencies
├── backend/                            # Spring Boot 3.4 REST Backend Gateway
│   ├── pom.xml                         # Maven dependencies (Hibernate Spatial, JTS, WebClient)
│   └── src/main/java/com/disastermgmt/
│       ├── config/                     # CORS, Jackson GIS serialization
│       ├── controller/                 # REST controllers (Scenario, Map, Priority, Route, Emergency)
│       ├── entity/                     # Spatial JPA entities (CapAlert, CadIncident, ResponseUnit, etc.)
│       ├── repository/                 # Spring Data JPA spatial repositories
│       └── service/                    # Business services (OASIS CAP 1.2 generator, CAD dispatcher)
├── frontend/                           # React 19 + Vite Frontend
│   ├── src/
│   │   ├── components/                 # TopBar navigation, Cesium 3D Globe, Brand Logo
│   │   ├── context/ThemeContext.jsx    # Persistent design tokens (Dark / Light)
│   │   ├── pages/                      # DisasterMap (2D/3D), EmergencyCADBoard, Dashboard, Reports
│   │   ├── services/api.js             # Axios client
│   │   └── App.jsx                     # Application routing shell
│   └── package.json                    # Node dependencies
├── data/                               # Scenario datasets & spatial registries
│   ├── india/                          # Chamoli, Fani, Dharali datasets & manifests
│   ├── osm/                            # Road vectors, hospital & shelter geometries
│   └── xbd_subset_v2/                  # Supervised xBD benchmark partition
├── outputs/                            # Diagnostic reports, research benchmarks & audit logs
└── scripts/                            # Operational scripts, db migration, training & E2E tests
```

---

## 👥 13. Team & Acknowledgments

**Developed with dedication by Team: The Debuggers**

- **Dataset Attributions**:
  - **Chamoli 2021 Data**: NERC Environmental Information Data Centre (EIDC) — Westoby et al. (2023).
  - **Cyclone Fani 2019 Data**: Copernicus Emergency Management Service (EMS) Rapid Mapping `EMSR357`.
  - **Dharali 2025 Data**: ISRO / Bhuvan & Sentinel-2 Open Data.
  - **xBD Dataset**: Maxar Technologies & Defense Innovation Unit (DIU).
  - **Base Maps & Corridors**: &copy; [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL).
- **Standards**: OASIS CAP v1.2, FEMA NIMS/ICS, WMO EW4All.
- **License**: MIT License.