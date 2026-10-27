# 📚 DRAS INDIA DISASTER DATASET V3 — COMPREHENSIVE DATASET CATALOGUE

## 1. Overview & Data Architecture

The **DRAS India Disaster Dataset V3** is a multi-hazard, multi-sensor geospatial intelligence catalogue specifically curated for disaster damage assessment across the Indian subcontinent. It couples foundation-level global disaster pretraining data (**xBD** and **BRIGHT**) and India-wide building footprint datasets (**Microsoft GlobalML** and **Google Open Buildings**) with **12 diverse Indian disaster events** spanning flash floods, tropical cyclones, cloudbursts, riverine inundation, landslides, and glacial lake outburst floods (GLOFs).

```
+---------------------------------------------------------------------------------------------------+
|                           DRAS V3 DATASET HIERARCHY & ROLE PARTITIONING                           |
|                                                                                                   |
|   [ 1. FOUNDATION PRETRAINING ]                                                                   |
|   • xBD Global Benchmark (DIU / Maxar)       -> 850,000+ buildings, 19 disasters, 0.5m VHR        |
|   • BRIGHT Multimodal Dataset (TUM / Zenodo)  -> 4,200 Optical+SAR pairs, 380,000+ instances      |
|   • Microsoft GlobalML India Footprints      -> 44,000,000 building polygons (Localisation Prior) |
|   • Google Open Buildings v3                 -> 82,000,000 building detections with confidence   |
|                                                                                                   |
|   [ 2. INDIAN DISASTER EVENT CATALOGUE (12 Multi-Hazard Events) ]                                 |
|   • Chamoli 2021 (Ice-rock avalanche / debris flow)  • Cyclone Fani 2019 (Cat 4 Cyclone)          |
|   • Dharali 2025 (Cloudburst / 20.4 ha debris fan)   • Wayanad 2024 (Landslide / SAR coherence)   |
|   • Kerala Floods 2018 (Monsoon dam deluge)          • Cyclone Amphan 2020 (Storm surge)          |
|   • Assam Floods 2022 (Brahmaputra riverine flood)   • Sikkim GLOF 2023 (Chungthang dam failure)  |
|   • Cyclone Biparjoy 2023 (Saurashtra/Kutch surge)   • Cyclone Michaung 2023 (Urban deluge)       |
|   • Himachal Cloudbursts 2023 (Beas river washout)   • Historic Chennai Floods 2015               |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Foundation Global Pretraining Sources

### 2.1 xBD Dataset (xView2 Challenge)
- **Source / Publisher**: Defense Innovation Unit (DIU) / Maxar Technologies
- **URL**: [https://xview2.org/](https://xview2.org/)
- **Licence**: Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)
- **Coverage**: Global (19 distinct disaster events, including wildfires, tsunamis, earthquakes, hurricanes)
- **Scale**: 4,500 pairs of $1024 \times 1024$ image tiles; 850,000+ building instances
- **Sensors & Resolution**: WorldView-2 and WorldView-3 (0.5m Ground Sample Distance - GSD)
- **Label Quality**: **EXACT** (Joint 4-class building damage grading: No Damage, Minor Damage, Major Damage, Destroyed)
- **DRAS Pipeline Role**: Stage 1 Localization pretraining and Stage 2 initial damage representation pretraining.

### 2.2 BRIGHT: Multimodal Paired Optical & SAR Disaster Dataset
- **Source / Publisher**: Technical University of Munich (TUM) / Zenodo
- **URL / DOI**: [https://zenodo.org/records/20072020](https://zenodo.org/records/20072020)
- **Licence**: Creative Commons Attribution 4.0 International (CC BY 4.0)
- **Coverage**: Global disaster areas affected by floods, hurricanes, and earthquakes
- **Scale**: 4,200 image pairs; 380,000+ building instances
- **Sensors & Resolution**: Co-registered Very-High-Resolution Optical + Sentinel-1 C-band SAR (10m) / TerraSAR-X
- **Label Quality**: **EXACT** (Ground structural state and flood inundation boundary)
- **DRAS Pipeline Role**: Pretraining multimodal optical + SAR change detection features (Model D). Enables DRAS to detect structural disruption through dense monsoon cloud cover.

### 2.3 Microsoft GlobalML Building Footprints (India Coverage)
- **Source / Publisher**: Microsoft Maps & AI for Earth
- **URL**: [https://github.com/microsoft/GlobalMLBuildingFootprints](https://github.com/microsoft/GlobalMLBuildingFootprints)
- **Licence**: Open Data Commons Open Database License (ODbL) / CDLA-Permissive
- **Coverage**: Pan-India building polygon coverage (44+ million structures)
- **Sensors & Resolution**: High-resolution Bing Maps satellite and aerial orthophotos
- **Label Quality**: **UNLABELLED for Damage** (Structural localization boundaries only; NO damage labels)
- **DRAS Pipeline Role**: Large-scale building localization pretraining. **Strictly NOT used as damage ground truth.**

### 2.4 Google Open Buildings v3 (South Asia / India)
- **Source / Publisher**: Google Research
- **URL**: [https://sites.research.google/gr/open-buildings/](https://sites.research.google/gr/open-buildings/)
- **Licence**: Creative Commons Attribution 4.0 (CC BY 4.0)
- **Coverage**: Continental-scale building footprints with fractional confidence scores and area
- **Sensors & Resolution**: High-resolution satellite imagery
- **Label Quality**: **UNLABELLED for Damage** (Detection polygons and confidence scores only)
- **DRAS Pipeline Role**: Unsupervised building boundary prior and exposure density estimation for operational zoning.

---

## 3. Indian Multi-Hazard Disaster Event Catalogue

| Event ID | Event Name | Hazard Type | State & District | Sensor & Resolution | Data Source & Licence | Label Quality | Catalogued Structures |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| `chamoli_2021` | Chamoli Flash Flood 2021 | Ice-Rock Avalanche / Debris Flow | Uttarakhand (Chamoli) | Sentinel-2 (10m) / Pleiades (0.5m) | NERC EIDC (Westoby et al., 2023) / OGL v3 | **EXACT** (Binary) | 6,455 |
| `fani_2019` | Cyclone Fani 2019 | Cat 4 Tropical Cyclone | Odisha (Puri & Khordha) | Sentinel-2 (10m) / Pleiades VHR | Copernicus EMSR357 / Open Access | **EXACT** (Points) | 9,777 |
| `dharali_2025` | Dharali Flash Flood 2025 | Cloudburst / Debris Fan | Uttarakhand (Uttarkashi) | Cartosat-2S / Resourcesat-2 (10m) | ISRO NRSC Bhuvan / ISRO Open Data | **WEAK** (Overlay) | 48 |
| `wayanad_2024` | Wayanad Landslide 2024 | Landslide / Debris Flow | Kerala (Wayanad) | Sentinel-1 SAR (10m) / OSM | OSM HOT #17242 / Copernicus / ODbL | **WEAK** (SAR+OSM) | 1,018 |
| `kerala_floods_2018` | Kerala Floods 2018 | Monsoon Flood & Dam Release | Kerala (Ernakulam, Thrissur) | Sentinel-1 SAR / Sentinel-2 (10m) | Copernicus EMSR303 / NRSC Bhuvan | **WEAK** (Inundation) | 8,420 |
| `cyclone_amphan_2020` | Super Cyclone Amphan 2020 | Tropical Cyclone / Storm Surge | West Bengal (S. 24 Parganas) | Sentinel-2 MSI (10m) / Landsat-8 | Copernicus EMSR439 / Open Access | **WEAK** (Swath) | 5,120 |
| `assam_floods_2022` | Assam Brahmaputra Floods 2022 | Riverine Flood | Assam (Cachar - Silchar) | Sentinel-1 SAR / Sentinel-2 (10m) | ASDMA / NRSC Bhuvan Flood Portal | **WEAK** (Inundation) | 4,200 |
| `sikkim_glacial_flood_2023` | South Lhonak GLOF 2023 | Glacial Lake Outburst Flood | Sikkim (North Sikkim, Chungthang) | Sentinel-1 SAR / Sentinel-2 / Cartosat | ISRO NRSC GLOF Assessment | **WEAK** (Scour) | 890 |
| `cyclone_biparjoy_2023` | Cyclone Biparjoy 2023 | Severe Cyclonic Storm | Gujarat (Kutch & Dwarka) | Sentinel-2 MSI (10m) / Sentinel-1 | IMD / GSDMA / Copernicus | **WEAK** (Wind Swath) | 3,100 |
| `cyclone_michaung_2023` | Cyclone Michaung Urban Deluge | Tropical Cyclone & Waterlogging | Tamil Nadu (Chennai & Tiruvallur) | Sentinel-1 SAR / Sentinel-2 (10m) | TNDMA / GCC / Copernicus | **WEAK** (Backscatter) | 7,200 |
| `himachal_cloudbursts_2023` | Himachal Flash Floods 2023 | Cloudburst / Landslide | Himachal Pradesh (Mandi, Kullu) | Sentinel-2 MSI (10m) / Sentinel-1 | HPSDMA / NRSC / Copernicus | **WEAK** (River Surge) | 1,450 |
| `chennai_floods_2015` | Historic Chennai Floods 2015 | Urban Inundation / Dam Surge | Tamil Nadu (Chennai) | Landsat-8 OLI (15m) / Sentinel-1A | USGS / ESA / OSM | **WEAK** (Historic) | 6,800 |
| **TOTAL** | **12 Regional Events** | **Multi-Hazard Cross-Section** | **8 Indian States** | **Optical + Radar Multi-Sensor** | **Fully Audited Public & Open Data** | **Audited** | **54,478** |

---

## 4. Academic Honesty & Label Provenance Rules

In accordance with DRAS research standards:
1. **Zero Synthetic Four-Class Labels**: When an event does not possess verified ground truth four-class damage labels (e.g. Dharali 2025, Assam 2022, Kerala 2018), DRAS **NEVER** synthesizes fake damage labels from flood polygons or damage loss reports.
2. **Point vs Polygon Distinction**: Copernicus EMSR357 records for Cyclone Fani are preserved strictly as **point observations**. They are not converted into fake building boundary polygons.
3. **Native Semantics**: The Chamoli 2021 dataset natively contains binary conditions (`1 = Intact`, `2 = Obstructed / Damaged`, `0 = Washed Out`). DRAS evaluates it under its native binary framework rather than shoehorning it into artificial 4-class accuracy figures.
4. **Weak vs Exact Partition**: All events are explicitly flagged as `EXACT` (ground survey or expert photo-interpretation) or `WEAK` (hazard boundary intersection). Models evaluated on `WEAK` events are reported as zero-shot transfer experiments.
