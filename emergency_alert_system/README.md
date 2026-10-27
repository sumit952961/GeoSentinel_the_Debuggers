# 🚨 AIDRS — Emergency Alert & Disaster Response System

This directory bundles **all alert-related source code, data models, controllers, UI components, XML specifications, and sample datasets** for the AIDRS Public Warning & Emergency Response platform.

---

## 📁 Directory Structure & File Manifest

```
emergency_alert_system/
├── README.md                              # This comprehensive architecture & reference guide
├── backend/                               # Spring Boot Java Backend Modules
│   ├── controller/
│   │   └── EmergencyResponseController.java # REST API endpoints for CAP alerts, XML, and CAD dispatch
│   ├── service/
│   │   └── EmergencyResponseService.java   # Core business logic: CAP 1.2 XML builder, priority scoring & routing
│   ├── entity/
│   │   ├── CapAlert.java                 # JPA Entity for OASIS CAP 1.2 specifications
│   │   ├── CadIncident.java              # JPA Entity for Computer-Aided Dispatch incidents & SOS calls
│   │   └── ResponseUnit.java             # JPA Entity for emergency response units (NDRF, Fire, EMS)
│   └── repository/
│       ├── CapAlertRepository.java       # Spring Data JPA Repository for CAP alerts
│       ├── CadIncidentRepository.java    # Repository for CAD incidents
│       └── ResponseUnitRepository.java   # Repository for emergency fleet units
├── frontend/                              # React & Web Audio Frontend Modules
│   ├── EmergencyCADBoard.jsx             # First Responder CAD command deck & multi-channel broadcast trigger
│   ├── DisasterMapAlertComponent.jsx     # Modular map alert overlay (Live bar, Turn Off/On, Briefing drawer)
│   └── sirenAudioSynthesizer.js          # Standalone Web Audio API dual-tone siren oscillator
├── samples/                               # Standardized Payload & Protocol Examples
│   ├── sample_cap_v1.2.xml               # Standard-compliant OASIS CAP 1.2 XML output
│   ├── sample_alerts_api.json            # JSON response payload for active scenario alerts
│   ├── sample_cad_incidents.json         # JSON sample for active emergency incidents
│   └── sample_response_units.json        # JSON sample for active first responder units
└── scripts/
    └── verify_alert_system.py            # Automated test & compliance verification script
```

---

## 📖 Industry Standards & Full Forms

| Acronym | Full Form | What It Is & Role in the System |
| :--- | :--- | :--- |
| **CAP** | **Common Alerting Protocol** | An open, international digital data format (ITU-T Recommendation X.1303 / OASIS standard) for exchanging public warnings across all hazard types, communication networks, and sensor platforms simultaneously. |
| **OASIS** | **Organization for the Advancement of Structured Information Standards** | The global non-profit consortium that standardizes XML and JSON specifications for mission-critical protocols (e.g., CAP, SAML, MQTT, ebXML). |
| **WEA** | **Wireless Emergency Alerts** | The public safety system that pushes geo-targeted, high-priority emergency text messages and alert tones to all 4G/5G mobile phones within a target geographic perimeter through local cell towers, without needing an app or cellular data. |
| **CMAS** | **Commercial Mobile Alert System** | The underlying technical architecture and protocol developed by FEMA and the FCC that powers WEA over cellular carrier networks. |
| **EAS** | **Emergency Alert System** | The national broadcast warning system that interrupts television broadcasts, cable TV, and AM/FM radio stations with alert tones and scrolling banner emergency instructions. |
| **EOC** | **Emergency Operations Center** | The central command and control facility where incident commanders, civil administration, military, police, and disaster teams coordinate disaster response. |
| **CAD** | **Computer-Aided Dispatch** | The mission-critical software used by emergency dispatch centers (911 / 112) to log incoming emergencies, track unit locations, and assign police, fire, ambulance, and rescue units. |
| **NDRF / SDRF** | **National / State Disaster Response Force** | Specialized disaster search, rescue, and evacuation armed forces in India. |
| **PostGIS** | **PostgreSQL Geographic Information System** | The spatial database engine used to run spherical polygon math, calculate zone intersections (`ST_Intersects`), build perimeter buffers, and compute safe evacuation routes. |
| **WGS84** | **World Geodetic System 1984 (EPSG:4326)** | The international standard spherical latitude/longitude coordinate system used by GPS, satellites, and GIS mapping. |
| **NOAA** | **National Oceanic and Atmospheric Administration** | Standard US meteorological authority whose alert format rules are mirrored in OASIS CAP 1.2. |

---

## 🔄 End-to-End Alert & Emergency Response Pipeline

```
[ Satellite / Drone Imagery ]
             │
             ▼
[ Model V4 AI Inference ] ─── (Detects & classifies structural damage & flood surge)
             │
             ▼
[ PostGIS Spatial Engine ] ── (Clusters buildings into operational sectors & computes hazard score)
             │
             ▼
[ Automated CAP 1.2 Engine ] (Generates standard OASIS XML with perimeter coordinates)
             │
    ┌────────┴───────────────────────────┬───────────────────────────┐
    ▼                                    ▼                           ▼
[ WEA/CMAS Cell Broadcast ]    [ EAS Radio / TV Crawl ]    [ Acoustic Siren Array ]
(Simulated phone tower push)   (Broadcast text generator)   (In-browser 600-960Hz dual-tone)
    │                                    │                           │
    └────────────────┬───────────────────┴───────────────────────────┘
                     ▼
         [ Interactive Operations Map & CAD ]
         - Real-time blinking strobe beacon
         - 1-Click "Turn Off" button clears alerts from map canvas
         - Briefing drawer with raw CAP XML copy
         - First responder dispatch with safe route calculations
```

---

## 🌐 REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/emergency/alerts/scenario/{id}` | Returns all CAP alerts for the given scenario |
| `GET` | `/api/emergency/alerts/active` | Returns currently active alerts across all scenarios |
| `POST` | `/api/emergency/alerts` | Creates a new custom CAP 1.2 alert payload |
| `POST` | `/api/emergency/alerts/generate-from-zone/{zoneId}` | Auto-generates a standardized CAP alert from a PostGIS operational zone |
| `GET` | `/api/emergency/alerts/{id}/cap.xml` | Returns standard-compliant OASIS CAP 1.2 XML payload |
| `GET` | `/api/emergency/units` | Returns all first responder units (NDRF, Ambulances, Fire engines) |
| `GET` | `/api/emergency/incidents/scenario/{id}` | Returns active CAD emergency incidents |
| `POST` | `/api/emergency/incidents` | Reports a new civilian SOS incident |
| `POST` | `/api/emergency/dispatch` | Dispatches an emergency response unit to an incident with routing |

---

## 🧪 Verification & Testing

To test and verify the entire alert system, run the bundled verification script:

```bash
python emergency_alert_system/scripts/verify_alert_system.py
```

Expected output:
```
=================================================================
AIDRS - EMERGENCY ALERT & CAD SYSTEM VERIFICATION
=================================================================
[PASS] Retrieved active CAP alerts for Scenario 2
[PASS] Valid OASIS CAP 1.2 XML verified (Status: Actual, MsgType: Alert)
[PASS] Retrieved emergency response units (NDRF, Ambulances, Fire)
[PASS] Retrieved CAD emergency incidents
=================================================================
[PASS] ALL EMERGENCY ALERT SYSTEM TESTS PASSED (100% COMPLIANT)
```
