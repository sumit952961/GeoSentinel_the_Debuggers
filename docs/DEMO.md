# 🎯 Faculty Demonstration Script & Step-by-Step Walkthrough

This document outlines the exact, verified sequence for presenting the **Disaster Management Decision-Support Platform** to evaluators and faculty.

---

## 🎬 1. Prerequisites (Setup Before Presentation)

1. **Start Spatial Database**: Ensure PostgreSQL 17 / PostGIS is running on port `5432`.
2. **Start FastAPI Service**:
   ```bash
   cd ai-service
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
3. **Start Spring Boot Backend**:
   ```bash
   cd backend
   .\mvnw.ps1 spring-boot:run
   ```
4. **Start React Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```
5. Open browser at: `http://localhost:5173`

---

## 🚀 2. Demonstration Sequence (10-Minute Walkthrough)

### Step 1: System Health & Architecture Verification (1 Minute)
1. In the top navigation bar, click **`⚙️ System Health`**.
2. **Key Talking Points**:
   - Point out that all three microservices are operational: **Spring Boot Backend (Port 8081)**, **PostGIS Spatial Database (Port 5432)**, and **FastAPI AI Engine (Port 8000)**.
   - Highlight that the system runs on standard consumer laptop CPU (Intel Core i5) with ₹0 recurring software cost.

---

### Step 2: Disaster Operations Map & Damage Assessment (3 Minutes)
1. Click **`🗺️ Operations Map & Routing`** in the top navigation bar.
2. The **2018 Southern California Wildfire (Woolsey Fire)** scenario loads automatically centered on Malibu / Santa Monica Mountains.
3. Observe the layers on the map:
   - **Disaster Boundary**: Red dotted polygon extent.
   - **AI Damage Predictions (181 Buildings)**:
     - 🟢 **No Damage** (106 buildings)
     - 🟡 **Minor Damage** (41 buildings)
     - 🟠 **Major Damage** (24 buildings)
     - 🔴 **Destroyed** (10 buildings)
   - **OpenStreetMap Road Network**: Slate blue corridors with violet dashed markers for blocked mountain passes.
   - **Emergency Facilities**: 7 Hospitals (Red '+' markers) and 6 Relief Shelters (Blue tent markers).
4. **Interactive Filters**:
   - Use the **Damage Filter** buttons (`Destroyed`, `Major Damage`) to isolate high-severity zones.
   - Adjust the **Confidence Threshold Slider** (e.g. set to $70\%$) to show high-confidence AI detections.
5. **Inspect Building Prediction**:
   - Click any **Destroyed** (Red) building on the map.
   - Show the popup displaying the **Predicted Class**, **Confidence (%)**, and the full **4-Class Softmax Probability Distribution**.
   - Note the clear attribution: *"Automated AI Prediction — unverified field report"*.

---

### Step 3: Explainable Multi-Factor Priority Ranking (2 Minutes)
1. In the top header under **MAP ANALYSIS MODE**, click **`🚨 Explainable Priority Ranking`**.
2. The map dynamically recolors the buildings into **Triage Urgency Levels**:
   - 🔴 **Critical Priority (≥70%)**: 2 buildings
   - 🟠 **High Priority (50-70%)**: 61 buildings
   - 🟡 **Medium Priority (30-50%)**: 105 buildings
   - 🟢 **Low Priority (<30%)**: 13 buildings
3. Click one of the **Critical Priority** (Red) buildings.
4. Point to the **Triage Breakdown Card** in the right sidebar:
   - **Damage Severity ($w_1 = 40\%$)**: Structural collapse risk.
   - **Population Exposure ($w_2 = 25\%$)**: Estimated multi-family occupant density.
   - **Critical Infrastructure Need ($w_3 = 20\%$)**: Proximity to emergency medical centers.
   - **Road Accessibility Impairment ($w_4 = 15\%$)**: Proximity to blocked mountain evacuation routes.
   - Read the generated **Human-Readable Reason** text explaining why this location requires urgent dispatch.

---

### Step 4: Emergency Evacuation Routing with Blockage Detour (3 Minutes)
1. In the selected Critical Building card in the sidebar, ensure **"Avoid Blocked Roads (Detour Mode)"** is checked.
2. Click **`🏥 Route to Hospital`**.
3. Observe the immediate calculation result ($<200\text{ ms}$):
   - A bold blue LineString route is drawn on the map connecting the building to **Malibu Urgent Care Center**.
   - Review the **Route Details Card**:
     - **Destination**: Malibu Urgent Care Center (40 beds)
     - **Distance**: 2.34 km
     - **Estimated Travel Time**: ~3.5 minutes
     - **Roadblock Detours**: 4 hazardous mountain canyon roads avoided (*Malibu Canyon Road, Kanan Dume Road, Mulholland Highway, Decker Canyon Road*).
4. Click **`⛺ Route to Shelter`** to show immediate rerouting to the closest safe refuge zone (**Pepperdine University Refuge Zone**, capacity: 1,200 evacuees).
5. Click **Clear** to reset the route.

---

### Step 5: Executive Summary & Scientific CV Metrics (1 Minute)
1. Click **`📊 Executive Summary`**:
   - Review the disaster summary cards, damage class proportions, and critical facility inventory.
2. Click **`🔬 AI Model Evaluation`**:
   - Show empirical metrics from the controlled xBD benchmark dataset:
     - Stage 1 U-Net Localization: **60.22% Pixel Dice F1**, **43.08% Pixel mIoU**, **84.04% Instance Building Recall**, **660 ms full-pair latency**.
     - Stage 2 Siamese Classifier: **31.99% Macro F1**, **150.3 buildings/second**.
   - Conclude with the honest discussion of class imbalance challenges in extreme disaster imagery.

---

## 🏆 3. Summary of Key Strengths to Emphasize

1. **Full-Stack Integration**: Complete pipeline from satellite pixels $\rightarrow$ Deep Learning $\rightarrow$ PostGIS $\rightarrow$ Spring Boot REST API $\rightarrow$ Leaflet UI.
2. **Explainable AI**: Not a black box; provides explicit multi-factor weighting and plain-language triage reasons.
3. **Hazard-Aware Routing**: Real-time graph routing that accounts for blocked evacuation routes.
4. **Scientific Integrity**: Honest reporting of model limitations and clear distinction between AI predictions and ground truth.
