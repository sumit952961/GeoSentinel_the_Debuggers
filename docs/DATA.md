# Disaster Management System — Data Architecture & Documentation

## 1. Architectural Separation: Training Dataset vs Demo Scenario

To guarantee academic rigor while keeping computational demands suitable for an Intel i5 CPU:

1. **GIS Demonstration Scenario (`data/xbd_subset_v1/` & PostGIS)**:
   - **Disaster Event**: 2018 Southern California Wildfire (Woolsey Fire / `socal-fire`)
   - **Location**: Malibu / Santa Monica Mountains, California, USA
   - **Purpose**: Demonstrates the end-to-end GIS pipeline (damage polygon overlays, road network blockages, hospital/shelter routing, and multi-criteria priority assessment).
   - **Contextual Infrastructure**: Complete OSM road network, emergency hospitals, and relief shelters ingested into PostGIS (SRID 4326).

2. **Computer Vision Training/Evaluation Dataset (`data/xbd_subset_v2/`)**:
   - **Disasters Included**: Multi-hazard composite (Hurricanes Michael, Matthew, Harvey; Santa Rosa Wildfire; Midwest Floods).
   - **Size**: 68 complete matched pre/post image pairs (136 PNG images, 136 JSON annotations, 68 target masks).
   - **Purpose**: Provides a balanced ground-truth dataset containing hundreds of real instances for **all four damage classes** for training and validating the building damage segmentation model.

---

## 2. Training Dataset (`xbd_subset_v2`) Class Distribution

| Class ID | Damage Level | Color (RGB) | Building Polygons | Percentage |
|---|---|---|---|---|
| **0** | **Background** | `[0, 0, 0]` (Black) | Non-building terrain | — |
| **1** | **No Damage** | `[45, 106, 79]` (Green) | 2,212 | 63.3% |
| **2** | **Minor Damage** | `[244, 162, 97]` (Amber) | 487 | 13.9% |
| **3** | **Major Damage** | `[231, 111, 81]` (Orange) | 372 | 10.6% |
| **4** | **Destroyed** | `[155, 34, 38]` (Red) | 424 | 12.1% |
| **Total** | | | **3,495** | **100.0%** |

### Breakdown by Candidate Disaster Event

| Disaster Event | Region | Total Pairs | No Damage | Minor Damage | Major Damage | Destroyed | Total Buildings |
|---|---|---|---|---|---|---|---|
| **Hurricane Michael** | Florida Panhandle, USA | 17 | 582 | 240 | 92 | 37 | 951 |
| **Hurricane Matthew** | North Carolina, USA | 14 | 94 | 199 | 39 | 53 | 385 |
| **Hurricane Harvey** | Texas Coast, USA | 12 | 326 | 34 | 237 | 90 | 687 |
| **Santa Rosa Wildfire** | California, USA | 10 | 600 | 4 | 2 | 232 | 838 |
| **Midwest Flooding** | Nebraska/Iowa, USA | 15 | 610 | 10 | 2 | 12 | 634 |
| **Total (Subset v2)** | Multi-Hazard | **68** | **2,212** | **487** | **372** | **424** | **3,495** |

---

## 3. Directory Layout

```
data/
├── xbd_subset_v1/          <-- GIS Demonstration Scenario (Woolsey Fire, Malibu CA)
│   ├── images/             (40 images)
│   ├── annotations/        (40 JSON annotations)
│   ├── sample_masks/
│   └── manifest.csv
│
├── xbd_subset_v2/          <-- CV Training & Evaluation Dataset (68 Pairs, 4 Classes)
│   ├── images/             (136 images, 1024x1024 RGB PNG)
│   ├── annotations/        (136 JSON annotations)
│   ├── masks/              (68 target segmentation masks, 8-bit uint8)
│   ├── sample_masks/       (Side-by-side 4-panel visual verification composites)
│   └── manifest.csv        (Manifest with pair_id, disaster, paths, and class counts)
│
└── osm/                    <-- GeoJSON Contextual Infrastructure for Demo Scenario
    ├── roads.geojson       (8 regional highway segments with blockage attributes)
    ├── hospitals.geojson   (7 emergency hospitals/clinics)
    ├── shelters.geojson    (6 emergency shelters)
    └── metadata.json
```

---

## 4. Geographical Consistency & Multi-Region Handling

- **Demo Scenario (Woolsey Fire)**: Mapped to a single contiguous bounding box `[34.0000° N, -118.8500° W, 34.1200° N, -118.5500° W]` with matching OpenStreetMap infrastructure in PostGIS.
- **CV Training Dataset (Subset v2)**: Spans 5 distinct geographic disaster zones across North America. Each image pair retains its authentic geographic center coordinates and WGS84 GPS polygon coordinates in `features.lng_lat`.
- **Handling Spatial Metadata**: In the CV training pipeline, images are processed in pixel coordinate space (`features.xy` and raster masks). When generating downstream GIS layers for scenarios, geometries are transformed to WGS84 (EPSG:4326) using each scenario's localized bounding box.
