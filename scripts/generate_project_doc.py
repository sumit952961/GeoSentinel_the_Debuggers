"""
Generates a professional Word document (.docx) for the AIDRS v2.0 Project Documentation
incorporating all project-specific architectural details, mathematical formulations,
NDMA comparative matrices, and operational workflows.
"""
import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

def set_cell_background(cell, hex_color):
    """Sets the background color of a table cell."""
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), hex_color)
    tc_pr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Sets inner margins for a table cell in dxa (1 pt = 20 dxa)."""
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tc_mar.append(node)
    tc_pr.append(tc_mar)

def create_document():
    doc = docx.Document()

    # Page Margins: 1 inch everywhere
    for section in doc.sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)

    # Base Styles
    styles = doc.styles
    normal_style = styles['Normal']
    normal_style.font.name = 'Calibri'
    normal_style.font.size = Pt(11)
    normal_style.font.color.rgb = RGBColor(30, 41, 59) # Slate 800

    # Colors
    NAVY_HEX = "0F172A"       # Primary Title / Headers
    BLUE_HEX = "1E3A8A"       # Subheadings
    ACCENT_HEX = "EA580C"     # Orange accent
    LIGHT_BG_HEX = "F1F5F9"   # Table header / Callout bg
    BORDER_HEX = "CBD5E1"

    # --- TITLE SECTION ---
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(0)
    title_p.paragraph_format.space_after = Pt(4)
    title_run = title_p.add_run("AI-DRIVEN DISASTER RESPONSE INTELLIGENCE SYSTEM (AIDRS v2.0)")
    title_run.font.size = Pt(22)
    title_run.font.bold = True
    title_run.font.color.rgb = RGBColor(15, 23, 42)

    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_after = Pt(16)
    sub_run = sub_p.add_run("Computer Vision and GIS-Based Decision Support Platform for Rapid Triage, Infrastructure Assessment, and Safe Evacuation Routing")
    sub_run.font.size = Pt(13)
    sub_run.font.italic = True
    sub_run.font.color.rgb = RGBColor(71, 85, 105)

    # Document Metadata Box
    meta_table = doc.add_table(rows=1, cols=1)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_cell = meta_table.cell(0, 0)
    set_cell_background(meta_cell, LIGHT_BG_HEX)
    set_cell_margins(meta_cell, 120, 120, 180, 180)
    meta_p = meta_cell.paragraphs[0]
    meta_p.paragraph_format.space_after = Pt(0)
    meta_run = meta_p.add_run(
        "Supporting Technical Proposal | National Disaster Management Ecosystem (NDMA / NDEM Alignment)\n"
        "Core Operational Paradigm: ASSESS  -->  PRIORITISE  -->  RESPOND\n"
        "Technical Stack: PyTorch (U-Net + Siamese ResNet34) | Spring Boot 3 | PostgreSQL 17 / PostGIS | NetworkX | CesiumJS 3D & Leaflet 2D"
    )
    meta_run.font.size = Pt(9.5)
    meta_run.font.bold = True
    meta_run.font.color.rgb = RGBColor(30, 41, 59)

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # Helper for Section Headings
    def add_heading_1(text):
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(16)
        h.paragraph_format.space_after = Pt(6)
        h.paragraph_format.keep_with_next = True
        run = h.add_run(text)
        run.font.size = Pt(14)
        run.font.bold = True
        run.font.color.rgb = RGBColor(15, 23, 42)
        return h

    def add_heading_2(text):
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(12)
        h.paragraph_format.space_after = Pt(4)
        h.paragraph_format.keep_with_next = True
        run = h.add_run(text)
        run.font.size = Pt(12)
        run.font.bold = True
        run.font.color.rgb = RGBColor(30, 58, 138)
        return h

    def add_p(text, bold_prefix=None, space_after=6):
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(space_after)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            r_bold = p.add_run(bold_prefix)
            r_bold.font.bold = True
            r_bold.font.color.rgb = RGBColor(15, 23, 42)
        run = p.add_run(text)
        run.font.color.rgb = RGBColor(51, 65, 85)
        return p

    # --- 1. INTRODUCTION ---
    add_heading_1("1. INTRODUCTION")
    add_p(
        "India features acute vulnerability to diverse natural hazards—including severe flash flooding, tropical cyclones, landslides, cloudbursts, and seismic events—amplified by varied topography and high settlement density. Recent catastrophes underline this vulnerability: the 2001 Gujarat Earthquake (~13,800 fatalities; 6.3 million affected), the 2004 Indian Ocean Tsunami (10,749 deaths), the 2015 Chennai Floods (1.8 million displaced), the 2018 Kerala Floods (5.4 million affected), and the devastating 2021 Chamoli Glacial Debris Flow in Uttarakhand."
    )
    add_p(
        "Official government statistics indicate that hydrometeorological disasters alone claimed 2,104 lives in 2022–23 and 2,922 lives in 2024–25 (up to December 2025), damaging over 3.7 lakh residential structures across affected states. During crisis events, Incident Commanders, the National Disaster Response Force (NDRF), and State Disaster Management Authorities (SDMAs) face a common operational bottleneck: raw disaster feeds indicate that destruction has occurred, but do not provide an immediate, prioritized operational picture detailing which specific sectors require rescue first or how emergency units can navigate around washed-away roads and debris barriers."
    )
    add_p(
        "To bridge this operational gap, the AI-Driven Disaster Response Intelligence System (AIDRS v2.0) bridges deep learning Computer Vision with Geographic Information Systems (GIS). By fusing bi-temporal post-disaster satellite/aerial imagery with spatial vector data in a PostGIS spatial database, AIDRS automatically extracts building footprint damage envelopes, calculates an explainable multi-factor priority score, and optimizes obstacle-aware ingress and egress routes over an impedance-weighted road graph."
    )

    # --- 2. PROBLEM STATEMENT ---
    add_heading_1("2. PROBLEM STATEMENT")
    add_p(
        "Conventional disaster response mechanisms identify the spatial extent of damage through post-event satellite imagery or delayed ground reconnaissance, but fail to provide an actionable operational roadmap. Disaster management authorities lack an integrated, map-based intelligence platform that quantitatively determines what needs rescue intervention first (explainable triage) and how first responders or stranded populations can traverse the terrain when primary road links are severed by floodwaters, landslides, and structural debris."
    )

    # --- 3. OBJECTIVES ---
    add_heading_1("3. OBJECTIVES")
    objectives = [
        ("Automated Multi-Scale Damage Assessment: ", "Ingest bi-temporal optical/SAR imagery and utilize deep-learning architectures (U-Net for building segmentation and Siamese ResNet34 for damage classification) to categorize structural destruction into 4 standardized severity tiers (No Damage, Minor, Major, Destroyed)."),
        ("Spatial Ingestion & Asset Mapping: ", "Vectorize neural prediction envelopes into GeoJSON polygons and persist them within a PostGIS spatial database alongside critical lifelines (hospitals, schools, shelters, bridges, and primary road networks)."),
        ("Explainable Multi-Criteria Priority Triage: ", "Formulate and compute an objective, multi-factor operational priority score (incorporating structural damage severity, estimated population density, physical road isolation, facility proximity, and hazard exposure) to group structures into ranked Operational Sectors."),
        ("Hazard-Aware Obstacle Routing: ", "Model the transportation network as an impedance-penalized mathematical graph, dynamically severing blocked links (collapsed bridges, debris fans, floodwaters) to calculate safe responder access corridors and civilian evacuation routes via Dijkstra / A* algorithms."),
        ("Dual-Engine Command GIS Dashboard: ", "Consolidate real-time spatial intelligence on a synchronized 3D (CesiumJS terrain/globe) and 2D (Leaflet) situational dashboard to deliver instant, audit-grade decision support to NDMA/SDMA emergency operation centers.")
    ]
    for pref, text in objectives:
        add_p(text, bold_prefix=pref, space_after=4)

    # --- 4. PROPOSED SYSTEM AS A SUPPORTING TOOL TO EXISTING NDMA/NDEM MODEL ---
    add_heading_1("4. PROPOSED SYSTEM AS A SUPPORTING TOOL TO EXISTING NDMA/NDEM ECOSYSTEM")
    add_p(
        "AIDRS v2.0 is specifically engineered to function as an operational decision-support accelerator for the National Disaster Management Authority (NDMA), the National Database for Emergency Management (NDEM - NRSC/ISRO), and State Emergency Operations Centers (SEOCs):"
    )

    # NDMA Table
    table_data = [
        ("Disaster-Management Step", "Existing NDMA / NDEM Ecosystem", "AIDRS v2.0 Proposed Contribution", "Operational Benefit"),
        (
            "1. Preparedness & Monitoring",
            "Static vulnerability maps, broad regional weather bulletins, and periodic hazard atlases.",
            "Dynamic hazard simulation and automated AI detection of rising water or slope instability from satellite feeds.",
            "Proactive contingency planning and faster identification of emerging localized hazards."
        ),
        (
            "2. Hazard & Damage Assessment",
            "Manual visual interpretation of satellite images and delayed, manual ground damage reports.",
            "Automated U-Net footprint segmentation and Siamese ResNet34 bi-temporal building collapse classification into 4 standardized damage tiers.",
            "Near real-time extraction of damage masks; reduction of assessment lag from days to minutes across wide geographic swathes."
        ),
        (
            "3. Exposure & Risk Ranking",
            "Static census overlays and qualitative, non-standardized field unit radio reports.",
            "PostGIS spatial clustering into Operational Sectors with an explainable 5-Factor Triage Formula (Damage, Vulnerability, Isolation, Proximity, Hazard).",
            "Objective quantification of vulnerable populations and mathematically defensible prioritization of rescue assets."
        ),
        (
            "4. Emergency Routing & Response",
            "Standard consumer navigation maps lacking real-time disaster hazard barriers and road washouts.",
            "Impedance-penalized graph routing (Dijkstra / NetworkX) dynamically culling blocked corridors; dual calculation of Ingress & Egress corridors.",
            "Guaranteed safe navigation for NDRF rescue convoys and civilian evacuation paths to operational hospitals and relief shelters."
        ),
        (
            "5. Decision Support & Recovery",
            "Disconnected data portals, static PDF status reports, and manual post-facto field auditing.",
            "Single dual-engine dashboard (CesiumJS 3D terrain + Leaflet 2D) unifying AI predictions, routing telemetry, and automated situation reports.",
            "Centralized, transparent situational awareness enabling instant tactical command decisions and auditable recovery monitoring."
        )
    ]

    table = doc.add_table(rows=len(table_data), cols=4)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False

    col_widths = [Inches(1.2), Inches(1.8), Inches(2.2), Inches(1.8)]

    for row_idx, row in enumerate(table.rows):
        is_header = (row_idx == 0)
        row_values = table_data[row_idx]
        for col_idx, cell in enumerate(row.cells):
            cell.width = col_widths[col_idx]
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.05
            run = p.add_run(row_values[col_idx])
            if is_header:
                set_cell_background(cell, NAVY_HEX)
                run.font.bold = True
                run.font.size = Pt(9.5)
                run.font.color.rgb = RGBColor(255, 255, 255)
            else:
                bg = LIGHT_BG_HEX if row_idx % 2 == 1 else "FFFFFF"
                set_cell_background(cell, bg)
                run.font.size = Pt(9)
                run.font.color.rgb = RGBColor(30, 41, 59)

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # --- 5. PROPOSED METHODOLOGY ---
    add_heading_1("5. PROPOSED METHODOLOGY & SYSTEM WORKFLOW")
    add_p(
        "The AIDRS methodology is governed by the core operational paradigm: ASSESS  -->  PRIORITISE  -->  RESPOND. The system ingests multi-source satellite imagery, processes pixel data through deep learning engines, projects localized geometries into a spatial database, and executes graph-theoretic optimization for tactical dispatch."
    )

    # Workflow Box
    wf_table = doc.add_table(rows=1, cols=1)
    wf_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    wf_cell = wf_table.cell(0, 0)
    set_cell_background(wf_cell, LIGHT_BG_HEX)
    set_cell_margins(wf_cell, 100, 100, 150, 150)
    wf_p = wf_cell.paragraphs[0]
    wf_p.paragraph_format.space_after = Pt(0)
    wf_p.add_run(
        "DATA INGESTION: Pre/Post Satellite Imagery (Sentinel-2 / High-Res) + Spatial Vectors (OSM / PostGIS)\n"
        "       |\n"
        "       v\n"
        "PHASE 1 (ASSESS): U-Net Building Localization  -->  Siamese ResNet34 Damage Classification (4 Tiers)\n"
        "       |\n"
        "       v\n"
        "PHASE 2 (PRIORITISE): PostGIS Spatial Clustering  -->  Explainable 5-Factor Triage Scoring Formula\n"
        "       |\n"
        "       v\n"
        "PHASE 3 (RESPOND): Road Hazard Obstacle Injection  -->  Impedance-Weighted Dijkstra Routing\n"
        "       |\n"
        "       v\n"
        "DECISION SUPPORT: Unified 3D Cesium & 2D Leaflet Dashboard  -->  Field Dispatch & Automated Reporting"
    ).font.size = Pt(9.5)
    for r in wf_p.runs:
        r.font.bold = True
        r.font.color.rgb = RGBColor(15, 23, 42)

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # --- 6. PROTOTYPE SYSTEM COMPONENTS ---
    add_heading_1("6. SYSTEM ARCHITECTURE & PROTOTYPE COMPONENTS")

    add_heading_2("6.1 Computer Vision & Damage Assessment Engine (PyTorch / FastAPI)")
    add_p(
        "The computer vision subsystem processes pre- and post-disaster optical and SAR satellite imagery via a two-stage deep learning pipeline:"
    )
    cv_points = [
        ("Stage 1 - Building Footprint Segmentation: ", "A modified U-Net architecture extracts building footprint polygons from high-resolution pre-disaster imagery. Footprints are converted into standardized Shapely/GeoJSON polygons."),
        ("Stage 2 - Siamese Damage Classification: ", "Extracted building crops from pre- and post-disaster imagery are fed into a dual-branch Siamese Convolutional Neural Network with a shared ResNet34 backbone. Feature difference vectors are classified into four damage tiers: (0) No Damage, (1) Minor Damage, (2) Major Damage, and (3) Destroyed."),
        ("Spatial Vectorization: ", "Pixel classification masks are vectorized into georeferenced GeoJSON polygons (EPSG:4326) and transmitted via RESTful API to the backend database with model inference confidence scores.")
    ]
    for pref, text in cv_points:
        add_p(text, bold_prefix=pref, space_after=4)

    add_heading_2("6.2 Spatial Database & GIS Analytics (Spring Boot 3 / PostgreSQL 17 + PostGIS)")
    add_p(
        "The spatial core couples enterprise Spring Boot microservices with a PostGIS database. Spatial layers include administrative boundaries, building footprints, transport corridors, healthcare facilities, and relief shelters. Spatial indexing (GiST) enables sub-millisecond execution of bounding-box spatial joins, nearest-facility queries, and distance clustering."
    )

    add_heading_2("6.3 Explainable 5-Factor Triage & Decision Engine")
    add_p(
        "Rather than relying on opaque black-box scoring or basic exposure counts, AIDRS v2.0 formulates an explainable, multi-factor mathematical triage ranking across operational sectors:"
    )
    
    # Formula Box
    f_table = doc.add_table(rows=1, cols=1)
    f_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    f_cell = f_table.cell(0, 0)
    set_cell_background(f_cell, LIGHT_BG_HEX)
    set_cell_margins(f_cell, 80, 80, 120, 120)
    f_p = f_cell.paragraphs[0]
    f_p.paragraph_format.space_after = Pt(0)
    f_run = f_p.add_run(
        "Priority Score (P) = w1·Damage + w2·Vulnerability + w3·Isolation + w4·Proximity + w5·Hazard\n"
        "Default Calibrated Weights: w1=0.35, w2=0.25, w3=0.15, w4=0.15, w5=0.10  (Sum = 1.00)"
    )
    f_run.font.size = Pt(10)
    f_run.font.bold = True
    f_run.font.color.rgb = RGBColor(15, 23, 42)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    formula_items = [
        ("Damage Severity Index (w1): ", "Proportion of structures classified as Destroyed or Major Damage within the sector."),
        ("Vulnerability Factor (w2): ", "Estimated occupancy density based on building floor area and residential density metrics."),
        ("Physical Road Isolation (w3): ", "Degree of transportation severedness (ratio of blocked access links to total connections)."),
        ("Facility Proximity (w4): ", "Network distance penalty to the nearest operational hospital and designated relief shelter."),
        ("Hazard Proximity (w5): ", "Physical buffer intersection with active flood inundation extents, landslide debris zones, or fire perimeters.")
    ]
    for pref, text in formula_items:
        add_p(text, bold_prefix=pref, space_after=3)

    add_heading_2("6.4 Dynamic Hazard-Aware Routing Engine (NetworkX / Dijkstra / A*)")
    add_p(
        "Standard commercial navigation solutions route vehicles along Euclidean or travel-time shortest paths without awareness of post-disaster physical hazards. AIDRS builds a topological road graph from OpenStreetMap data and overlays detected hazard polygons (debris flows, flood inundation, bridge collapses):"
    )
    routing_points = [
        ("Impedance Penalization: ", "Severed or high-hazard road links are dynamically assigned infinite impedance (cost = infinity), eliminating them from graph traversal."),
        ("Responder Access Routing (Ingress): ", "Calculates the safest, lowest-impedance path for NDRF rescue teams and medical convoys traveling from operational staging depots to high-priority triage sectors."),
        ("Civilian Evacuation Routing (Egress): ", "Computes unobstructed exit routes guiding displaced populations from damaged settlement clusters directly to open relief shelters and operating medical centers.")
    ]
    for pref, text in routing_points:
        add_p(text, bold_prefix=pref, space_after=4)

    add_heading_2("6.5 Dual-Engine Command GIS Dashboard (React 19 / CesiumJS 3D & Leaflet 2D)")
    add_p(
        "Emergency command requires both rapid 2D tactical overviews and 3D terrain visualization. AIDRS integrates a synchronized dual-engine architecture: CesiumJS renders full 3D terrain elevation, crucial for Himalayan flash floods (such as Chamoli and Dharali) where valley slopes and debris lines dictate rescue feasibility. Leaflet provides lightweight, instant 2D vector inspection. The interface features building-level inspection drawers, live filter toggles, situational KPI cards, and one-click JSON/CSV situation report exports."
    )

    # --- 7. VERIFIED DEMONSTRATION SCENARIOS ---
    add_heading_1("7. VERIFIED DEMONSTRATION SCENARIOS & EMPIRICAL DATASETS")
    add_p(
        "AIDRS v2.0 is validated across four verified disaster scenarios representing distinct hydrometeorological and geological hazard profiles:"
    )
    scenarios = [
        ("2021 Chamoli Flash Flood (Uttarakhand, India): ", "Ice-rock avalanche and glacial debris flow along Rishiganga/Dhauliganga rivers. Ground truth verified via UKRI/EIDC Westoby et al. building damage datasets and Copernicus Sentinel-2 imagery; demonstrates 3D canyon terrain and washed-away bridge isolation."),
        ("2018 Woolsey Wildfire (Southern California): ", "Severe urban-wildland interface wildfire. Verified ground truth from the xBD benchmark comprising 181 assessed structures, 63 high-priority targets, 7 hospitals, 6 shelters, and 4 hazardous corridors."),
        ("2019 Cyclone Fani (Odisha, India): ", "Category 5 equivalent tropical cyclone. Tested against verified Copernicus EMSR357 point impact observations and storm-surge inundation layers."),
        ("2025 Dharali Flash Flood (Uttarkashi, Uttarakhand): ", "High-altitude cloudburst and debris fan along the Kheer Ganga-Bhagirathi confluence; validated as an ISRO/NRSC debris extent generalisation testbed.")
    ]
    for pref, text in scenarios:
        add_p(text, bold_prefix=pref, space_after=4)

    # --- 8. EXPECTED OUTCOME & QUANTITATIVE DELIVERABLES ---
    add_heading_1("8. EXPECTED OUTCOME & SYSTEM IMPACT")
    outcomes = [
        ("Operational Assessment Speed: ", "Compresses initial damage survey timelines from 48–72 hours of manual scouting down to sub-15-minute automated satellite inference runs."),
        ("Objective Triage Prioritization: ", "Replaces subjective field reports with an explainable, mathematical ranking of operational sectors, ensuring optimal deployment of scarce NDRF/SDRF rescue personnel."),
        ("Life-Safety Ingress/Egress Corridors: ", "Prevents emergency vehicular ambushes in blocked debris zones by generating dynamically verified, hazard-avoiding routes."),
        ("Centralized Interoperability: ", "Eliminates siloed data by unifying computer vision masks, demographic census grids, and transport graphs in standard GeoJSON/PostGIS formats for immediate consumption by NDMA and district emergency operation centers.")
    ]
    for pref, text in outcomes:
        add_p(text, bold_prefix=pref, space_after=4)

    # --- 9. CONCLUSION ---
    add_heading_1("9. CONCLUSION")
    add_p(
        "By synthesizing computer vision, spatial database engineering, explainable decision analysis, and obstacle-aware graph routing, the AI-Driven Disaster Response Intelligence System (AIDRS v2.0) transforms raw disaster satellite feeds into an actionable tactical roadmap. The platform moves beyond simply showing what is damaged—it empowers incident commanders to determine what requires attention first, why it matters, and how first responders can safely reach the scene. AIDRS v2.0 provides an operational, scalable, and audit-grade decision-support system ready for deployment within India's disaster management framework."
    )

    # Save to file
    out_path = r"c:\Users\rajat\OneDrive\Desktop\Disaster_Management_System\AIDRS_Project_Documentation.docx"
    doc.save(out_path)
    print(f"Document successfully created at: {out_path}")

if __name__ == "__main__":
    create_document()
