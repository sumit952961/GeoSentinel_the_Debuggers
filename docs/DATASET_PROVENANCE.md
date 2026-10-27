# DRAS Dataset Provenance & Physical Audit Report

**Audit Date**: 2026-09-21  
**Methodology**: Strict physical verification of files on disk. Every dataset is explicitly classified into one of four verified status tiers:

- `VERIFIED_TRAINABLE`: Physical imagery, masks, and annotations exist on disk, verified non-corrupted, validated in `india_v4_manifest.csv`, and active in model training/evaluation pipelines.
- `PROCESSED_DATA_AVAILABLE`: Physical data exists on disk in processed/extracted form, available for evaluation or transfer learning.
- `RAW_DATA_AVAILABLE`: Physical raw archive exists on disk awaiting unpacking/standardization.
- `CATALOGUE_ONLY`: Schema definition and data acquisition specifications exist in metadata and README documentation; physical satellite raster files are NOT stored locally.

---

## Complete Dataset Provenance Matrix

| Dataset Name | Source URL | Licence | Sensor | GSD | Pre/Post Pairs | Usable Tiles | Download Size | Label Quality | Trainable Status |
|---|---|---|---|---|:---:|:---:|:---:|:---:|:---:|
| **xBD Global Disaster Subset v2** | [https://xview2.org/...](https://xview2.org/) | CC BY-NC 4.0 | WorldView-2 / WorldView-3 | 0.5m | 68/68 | 68 | 220.28 MB | EXACT | **VERIFIED_TRAINABLE** |
| **BRIGHT / xBD Multimodal Global Holdout** | [https://zenodo.org/records/200...](https://zenodo.org/records/20072020) | CC BY 4.0 | WorldView Optical + Sentinel Change Pairs | 0.5m - 10m | 156/156 | 156 | 449.59 MB (Unpacked) / 455.19 MB (Cache) | EXACT | **VERIFIED_TRAINABLE** |
| **Chamoli Flash Flood 2021 (NERC EIDC)** | [https://doi.org/10.5285/38be1a...](https://doi.org/10.5285/38be1a47-a979-469b-9c78-cf9f5d143048) | Open Government Licence v3.0 | Sentinel-2 L2A + Pleiades VHR | 10m raster / 0.5m vector | 8/8 | 8 | 12.61 MB | EXACT | **VERIFIED_TRAINABLE** |
| **Cyclone Fani 2019 (Copernicus EMSR357)** | [https://emergency.copernicus.e...](https://emergency.copernicus.eu/mapping/list-of-activations-rapid/EMSR357) | Copernicus Open Access | Sentinel-2 MSI | 10m | 10/10 | 10 | 23.74 MB | EXACT | **VERIFIED_TRAINABLE** |
| **Dharali Flash Flood 2025 (ISRO Bhuvan)** | [https://bhuvan.nrsc.gov.in/...](https://bhuvan.nrsc.gov.in/) | ISRO Open Data Policy | Sentinel-2 L2A / Cartosat-2S | 10m | 6/6 | 6 | 6.94 MB | WEAK | **VERIFIED_TRAINABLE (Localisation / Exposure Only)** |
| **xBD Subset v1 (Legacy Initial Extraction)** | [https://xview2.org/...](https://xview2.org/) | CC BY-NC 4.0 | WorldView-2 / WorldView-3 | 0.5m | 20/20 | 20 | 64.70 MB | EXACT | **PROCESSED_DATA_AVAILABLE** |
| **Wayanad Landslides 2024** | [https://bhuvan.nrsc.gov.in/ / ...](https://bhuvan.nrsc.gov.in/ / OSM HOT) | ODbL / ISRO Policy | Sentinel-2 / Cartosat-3 | 10m | 0/0 | 0 | 0.00 MB (Catalog only) | WEAK | **CATALOGUE_ONLY** |
| **Kerala Floods 2018 (Copernicus EMSR303)** | [https://emergency.copernicus.e...](https://emergency.copernicus.eu/mapping/list-of-activations-rapid/EMSR303) | Copernicus Open Access | Sentinel-1 SAR / Sentinel-2 | 10m | 0/0 | 0 | 0.00 MB (Catalog only) | WEAK | **CATALOGUE_ONLY** |
| **Cyclone Amphan 2020 (Copernicus EMSR439)** | [https://emergency.copernicus.e...](https://emergency.copernicus.eu/mapping/list-of-activations-rapid/EMSR439) | Copernicus Open Access | Sentinel-2 / Pleiades | 10m | 0/0 | 0 | 0.00 MB (Catalog only) | WEAK | **CATALOGUE_ONLY** |
| **Assam Riverine Floods 2022** | [https://asdma.assam.gov.in/...](https://asdma.assam.gov.in/) | Open Data Assam / NRSC | Sentinel-1 SAR / RISAT-1A | 10m | 0/0 | 0 | 0.00 MB (Catalog only) | WEAK | **CATALOGUE_ONLY** |
| **Sikkim South Lhonak GLOF 2023** | [https://bhuvan.nrsc.gov.in/...](https://bhuvan.nrsc.gov.in/) | ISRO Open Data Policy | Sentinel-2 / Resourcesat | 10m | 0/0 | 0 | 0.00 MB (Catalog only) | WEAK | **CATALOGUE_ONLY** |
| **Cyclone Biparjoy 2023** | [https://mausam.imd.gov.in/...](https://mausam.imd.gov.in/) | IMD Open Data | Sentinel-2 / INSAT-3DR | 10m - 1km | 0/0 | 0 | 0.00 MB (Catalog only) | WEAK | **CATALOGUE_ONLY** |
| **Cyclone Michaung Chennai Floods 2023** | [https://tndma.tn.gov.in/...](https://tndma.tn.gov.in/) | TNDMA Open Data | Sentinel-2 | 10m | 0/0 | 0 | 0.00 MB (Catalog only) | WEAK | **CATALOGUE_ONLY** |
| **Himachal Pradesh Cloudbursts 2023** | [https://hpsdma.nic.in/...](https://hpsdma.nic.in/) | HPSDMA Open Data | Sentinel-2 L2A | 10m | 0/0 | 0 | 0.00 MB (Catalog only) | WEAK | **CATALOGUE_ONLY** |
| **Chennai Urban Floods 2015** | [https://earthexplorer.usgs.gov...](https://earthexplorer.usgs.gov/) | USGS Public Domain | Landsat-8 OLI | 30m | 0/0 | 0 | 0.00 MB (Catalog only) | WEAK | **CATALOGUE_ONLY** |

---

## Physical Dataset Summary

- **Total Physical Disaster Scene Pairs on Disk**: **268 pairs** (536 satellite images + 258 target masks)
- **Total Physical Dataset Size on Disk**: **777.93 MB** (unpacked rasters & vector geometries) / **1.23 GB** (including raw archive cache)
- **Total Indian Disaster Pairs with Physical Raster Imagery**: **24 pairs** (8 Chamoli, 10 Fani, 6 Dharali)
- **Total Global Disaster Pairs with Physical Imagery**: **244 pairs** (156 xBD/BRIGHT holdout, 68 xBD v2, 20 xBD v1)
- **Total Building Polygons in Physical Vector Datasets**: **6,455 building footprints** (Chamoli NERC EIDC)
- **Total Surveyed Damage Points in Physical Vector Datasets**: **9,777 damage points** (Cyclone Fani Copernicus EMSR357)
