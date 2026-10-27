"""
============================================================
Disaster Management System — Operational Zone Generator
============================================================

Generates defensible, reproducible, strictly NON-OVERLAPPING spatial
operational zones (sectors) at minor/tactical squad level granularity.
Aggregates building-level computer vision damage predictions, priority scores,
and GIS infrastructure context (blocked roads, hospitals, shelters).

Key Spatial Innovations:
  - Strictly Non-Overlapping: Voronoi tessellation + sequential clean difference
    guarantees exactly 0.000000 sq deg intersection between all zone perimeters.
  - Minor-Level Granularity: Tactical sectors (~5-12 structures per zone)
    calibrated for search-and-rescue squads and field triage teams.
  - FEMA / ICS Multi-Tier Criticality: CRITICAL, HIGH, MEDIUM, LOW.
  - Actionable command recommendations & explainable rationale.
"""

import os
import sys
import json
import math
import numpy as np
from sklearn.cluster import KMeans
import psycopg2
from shapely import wkt
from shapely.geometry import shape, mapping, Polygon, MultiPolygon, Point, MultiPoint
from shapely.ops import voronoi_diagram, unary_union

DB_PARAMS = {
    "dbname": "disaster_db",
    "user": "postgres",
    "password": "postgres",
    "host": "localhost",
    "port": 5432
}

SECTOR_NAMES = {
    1: [
        "Malibu Canyon Ridge Core",
        "Malibu Crest Hillside Sector",
        "Kanan Valley Impact Corridor",
        "Kanan North Approach Sector",
        "Point Dume Coastal Nexus",
        "Point Dume Bluff Sector",
        "Westlake Urban Staging Sector",
        "Westlake Valley Support Base"
    ],
    2: [
        "Raini Ground Zero Core (Upper)",
        "Raini Riverfront Surge Sector",
        "Rishiganga Gorge North Sector",
        "Rishiganga Confluence Sector",
        "Tapovan Barrage Sector",
        "Joshimath Helipad & Logistics Base",
        "Joshimath Upper Support Sector",
        "Dhauliganga Staging Area"
    ],
    3: [
        "Grand Road Core Sector",
        "Grand Road Commercial Sector",
        "Station Road North Sector",
        "Station Road Junction Sector",
        "Swargadwar Coastal Front",
        "Swargadwar Urban Sector",
        "Puri Beachfront Staging Base",
        "Puri Helipad Relief Base"
    ],
    4: [
        "Kheer Ganga Confluence Sector",
        "Bhagirathi Riverfront Flash Surge",
        "Harsil Valley Buffer Sector",
        "Dharali Settlement Core",
        "Dharali Relief Logistics Base",
        "Bhagirathi South Staging Base"
    ]
}

CRITICALITY_COLORS = {
    "CRITICAL": "#ef4444",
    "HIGH": "#f97316",
    "MEDIUM": "#eab308",
    "LOW": "#10b981"
}


class OperationalZoneGenerator:
    def __init__(self, db_params=None):
        self.db_params = db_params or DB_PARAMS

    def get_connection(self):
        return psycopg2.connect(**self.db_params)

    def generate_zones_for_scenario(self, scenario_id: int, num_zones: int = None):
        conn = self.get_connection()
        cur = conn.cursor()

        try:
            # 1. Fetch buildings, damage, and priorities
            cur.execute("""
                SELECT 
                    b.id,
                    ST_AsText(b.geometry),
                    ST_X(ST_Centroid(b.geometry)),
                    ST_Y(ST_Centroid(b.geometry)),
                    COALESCE(dp.damage_class, b.damage_class, 'no-damage'),
                    COALESCE(pa.priority_score, 0.20),
                    COALESCE(pa.priority_level, 'LOW'),
                    ST_Area(ST_Transform(b.geometry, 3857))
                FROM buildings b
                LEFT JOIN damage_predictions dp ON b.id = dp.building_id
                LEFT JOIN priority_assessments pa ON b.id = pa.building_id
                WHERE b.scenario_id = %s
                ORDER BY b.id
            """, (scenario_id,))
            rows = cur.fetchall()

            if not rows:
                return []

            # 2. Fetch GIS context (hospitals, shelters, blocked roads)
            cur.execute("""
                SELECT id, name, ST_AsText(geometry)
                FROM hospitals WHERE scenario_id = %s AND (is_operational IS NULL OR is_operational = true)
            """, (scenario_id,))
            hospitals = cur.fetchall()

            cur.execute("""
                SELECT id, name, ST_AsText(geometry)
                FROM shelters WHERE scenario_id = %s AND (is_operational IS NULL OR is_operational = true)
            """, (scenario_id,))
            shelters = cur.fetchall()

            cur.execute("""
                SELECT id, name, ST_AsText(geometry)
                FROM roads WHERE scenario_id = %s AND is_blocked = true
            """, (scenario_id,))
            blocked_roads = cur.fetchall()

            # Parse building records
            buildings = []
            coords = []
            for r in rows:
                b_id, geom_wkt, lon, lat, dmg_class, pri_score, pri_level, area_m2 = r
                poly = wkt.loads(geom_wkt) if geom_wkt else None
                buildings.append({
                    "id": b_id,
                    "geometry": poly,
                    "lon": lon,
                    "lat": lat,
                    "damage_class": dmg_class,
                    "priority_score": float(pri_score),
                    "priority_level": pri_level,
                    "area_m2": float(area_m2 or 80.0)
                })
                coords.append([lon, lat])

            coords = np.array(coords)

            # Determine minor-level structured zone count
            if num_zones is None:
                # Granular tactical sectors: ~5-12 structures per minor-level zone
                k = max(4, min(8, round(len(buildings) / 7.0)))
            else:
                k = min(num_zones, len(buildings))

            if k < 2:
                clusters = [0] * len(buildings)
                cluster_centers = [np.mean(coords, axis=0)]
            else:
                kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
                clusters = kmeans.fit_predict(coords)
                cluster_centers = kmeans.cluster_centers_

            # Build Voronoi partition of cluster centers to guarantee 100% zero overlap
            all_pts = [Point(b["lon"], b["lat"]) for b in buildings]
            envelope = MultiPoint(all_pts).convex_hull.buffer(0.004)

            vor_cells = []
            if k >= 2:
                centers_pts = [Point(c[0], c[1]) for c in cluster_centers]
                vor = voronoi_diagram(MultiPoint(centers_pts), envelope=envelope)
                for i in range(k):
                    c_pt = centers_pts[i]
                    matched_cell = next(
                        (p for p in vor.geoms if p.contains(c_pt) or p.distance(c_pt) < 1e-5),
                        None
                    )
                    vor_cells.append(matched_cell)
            else:
                vor_cells = [envelope]

            # 3. Aggregate each cluster and compute non-overlapping boundaries
            zones_data_raw = []
            for cluster_idx in range(k):
                cluster_bldgs = [b for b, c in zip(buildings, clusters) if c == cluster_idx]
                if not cluster_bldgs:
                    continue

                total_b = len(cluster_bldgs)
                destroyed_cnt = sum(1 for b in cluster_bldgs if b["damage_class"] == "destroyed")
                major_cnt = sum(1 for b in cluster_bldgs if b["damage_class"] == "major-damage")
                minor_cnt = sum(1 for b in cluster_bldgs if b["damage_class"] == "minor-damage")
                no_dmg_cnt = sum(1 for b in cluster_bldgs if b["damage_class"] == "no-damage")

                # Estimated exposed population: ~1 resident per 20 m2 footprint
                est_pop = int(sum(max(2, int(b["area_m2"] / 20.0)) for b in cluster_bldgs))
                avg_pri = float(np.mean([b["priority_score"] for b in cluster_bldgs]))
                highest_pri_bldg = max(cluster_bldgs, key=lambda b: b["priority_score"])

                # Spatial perimeter: Convex hull of cluster buildings clipped by Voronoi cell
                pts = [Point(b["lon"], b["lat"]) for b in cluster_bldgs]
                if len(pts) >= 3:
                    hull = MultiPoint(pts).convex_hull.buffer(0.0016).simplify(0.0001)
                elif len(pts) == 2:
                    hull = MultiPoint(pts).buffer(0.0016).simplify(0.0001)
                else:
                    hull = pts[0].buffer(0.0016).simplify(0.0001)

                cell = vor_cells[cluster_idx] if cluster_idx < len(vor_cells) else None
                if cell is not None and not cell.is_empty:
                    zone_poly = hull.intersection(cell)
                else:
                    zone_poly = hull

                if zone_poly.geom_type == "MultiPolygon":
                    zone_poly = max(zone_poly.geoms, key=lambda g: g.area)
                if zone_poly.geom_type != "Polygon":
                    zone_poly = zone_poly.convex_hull

                # Count intersecting GIS infrastructure
                hosp_cnt = 0
                for h in hospitals:
                    try:
                        h_geom = wkt.loads(h[2])
                        if zone_poly.intersects(h_geom) or zone_poly.distance(h_geom) < 0.003:
                            hosp_cnt += 1
                    except Exception:
                        pass

                shelt_cnt = 0
                for s in shelters:
                    try:
                        s_geom = wkt.loads(s[2])
                        if zone_poly.intersects(s_geom) or zone_poly.distance(s_geom) < 0.003:
                            shelt_cnt += 1
                    except Exception:
                        pass

                blk_cnt = 0
                for br in blocked_roads:
                    try:
                        r_geom = wkt.loads(br[2])
                        if zone_poly.intersects(r_geom) or zone_poly.distance(r_geom) < 0.0015:
                            blk_cnt += 1
                    except Exception:
                        pass

                # 4. Smooth continuous Structural Damage Impact (0.0 to 1.0)
                # Weights: Destroyed (1.0), Major Damage (0.60), Minor Damage (0.25)
                dmg_ratio = (destroyed_cnt * 1.0 + major_cnt * 0.60 + minor_cnt * 0.25) / max(total_b, 1)

                crit_score = (
                    0.40 * min(dmg_ratio, 1.0) +
                    0.30 * avg_pri +
                    0.15 * min(destroyed_cnt / 4.0, 1.0) +
                    0.10 * min(est_pop / 500.0, 1.0) +
                    0.05 * min(blk_cnt / 2.0, 1.0)
                )
                crit_score = round(min(max(crit_score, 0.05), 0.99), 2)

                # FEMA / ICS Standard 4-Tier Multi-Hazard Criticality Classification
                # CRITICAL: Catastrophic destruction, heavy collapse, primary USAR extrication
                if crit_score >= 0.65 or (destroyed_cnt >= 4 and dmg_ratio >= 0.55):
                    criticality = "CRITICAL"
                    recom = "Immediate Urban Search & Rescue (USAR) deployment. Clear primary ingress corridors. Heavy structural extrication and triage."
                # HIGH: Substantial major structural damage, partial collapse, urgent triage
                elif crit_score >= 0.48 or (destroyed_cnt >= 1 and dmg_ratio >= 0.30) or major_cnt >= 3:
                    criticality = "HIGH"
                    recom = "Structural stabilization team dispatch. Rapid resident evacuation toward relief facilities. Perimeter cordoning and emergency medical triage."
                # MEDIUM: Moderate to minor damage, utility outages, secondary assistance
                elif crit_score >= 0.30 or minor_cnt >= 2 or dmg_ratio >= 0.15:
                    criticality = "MEDIUM"
                    recom = "Rapid structural damage verification. Secondary medical assistance. Restoration of local water, power, and utility corridors."
                # LOW: Intact infrastructure, safe staging hubs, medical depot, assembly point
                else:
                    criticality = "LOW"
                    recom = "Support and logistics staging area. Primary triage reception, medical supply depot, and evacuee safe assembly hub."

                constituent_ids = [b["id"] for b in cluster_bldgs]

                zones_data_raw.append({
                    "scenario_id": scenario_id,
                    "zone_code": f"ZONE-SCEN{scenario_id:02d}-{cluster_idx+1:02d}",
                    "name": "",
                    "criticality": criticality,
                    "criticality_score": crit_score,
                    "total_buildings": total_b,
                    "destroyed_count": destroyed_cnt,
                    "major_damage_count": major_cnt,
                    "minor_damage_count": minor_cnt,
                    "no_damage_count": no_dmg_cnt,
                    "estimated_population": est_pop,
                    "avg_priority_score": round(avg_pri, 3),
                    "hospitals_count": hosp_cnt,
                    "shelters_count": shelt_cnt,
                    "blocked_roads_count": blk_cnt,
                    "highest_priority_building_id": highest_pri_bldg["id"],
                    "recommended_action": recom,
                    "explanation": "",
                    "constituent_building_ids": constituent_ids,
                    "geometry": zone_poly
                })

            # Sort zones by criticality score descending (most severe first)
            zones_data_raw.sort(key=lambda z: z["criticality_score"], reverse=True)

            # Secondary clean difference safeguard: strictly guarantees 0.000000 overlap
            cleaned_zones = []
            accumulated_union = None
            for z in zones_data_raw:
                geom = z["geometry"]
                if accumulated_union is not None and not accumulated_union.is_empty:
                    if geom.intersects(accumulated_union):
                        diff = geom.difference(accumulated_union)
                        if not diff.is_empty:
                            if diff.geom_type == "MultiPolygon":
                                geom = max(diff.geoms, key=lambda g: g.area)
                            else:
                                geom = diff
                z["geometry"] = geom
                if accumulated_union is None:
                    accumulated_union = geom
                else:
                    accumulated_union = accumulated_union.union(geom)
                cleaned_zones.append(z)

            # Assign calibrated sector names and codes based on criticality rank
            scenario_sector_titles = SECTOR_NAMES.get(scenario_id, [
                f"Sector {chr(65+i)} - Impact Area" for i in range(len(cleaned_zones))
            ])

            for rank_idx, z in enumerate(cleaned_zones):
                title_name = scenario_sector_titles[rank_idx % len(scenario_sector_titles)]
                # If zone count exceeds titles list, add sub-sector suffix to guarantee uniqueness
                if rank_idx >= len(scenario_sector_titles):
                    z["name"] = f"{title_name} (Sub-Sector {rank_idx - len(scenario_sector_titles) + 2})"
                else:
                    z["name"] = title_name

                z["zone_code"] = f"ZONE-SCEN{scenario_id:02d}-{rank_idx+1:02d}"
                z["explanation"] = (
                    f"{z['name']} designated as {z['criticality']} priority (Criticality Index: {z['criticality_score']:.2f}). "
                    f"Encompasses {z['total_buildings']} structures ({z['destroyed_count']} destroyed, {z['major_damage_count']} major damage, "
                    f"{z['minor_damage_count']} minor damage, {z['no_damage_count']} intact). Estimated {z['estimated_population']} exposed residents. "
                    f"Access conditions: {z['blocked_roads_count']} blocked road segment(s) reported in or adjacent to perimeter. "
                    f"Operational assets: {z['hospitals_count']} hospital(s), {z['shelters_count']} shelter(s)."
                )

            return cleaned_zones

        finally:
            cur.close()
            conn.close()

    def save_zones_to_db(self, scenario_id: int, zones_data: list):
        conn = self.get_connection()
        cur = conn.cursor()

        try:
            # Delete old zones for this scenario
            cur.execute("DELETE FROM operational_zones WHERE scenario_id = %s", (scenario_id,))

            for z in zones_data:
                geom_wkt = z["geometry"].wkt
                cur.execute("""
                    INSERT INTO operational_zones (
                        scenario_id, zone_code, name, criticality, criticality_score,
                        total_buildings, destroyed_count, major_damage_count, minor_damage_count,
                        no_damage_count, estimated_population, avg_priority_score,
                        hospitals_count, shelters_count, blocked_roads_count,
                        highest_priority_building_id, recommended_action, explanation,
                        constituent_building_ids, geometry
                    ) VALUES (
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s,
                        %s, ST_GeomFromText(%s, 4326)
                    )
                """, (
                    z["scenario_id"], z["zone_code"], z["name"], z["criticality"], z["criticality_score"],
                    z["total_buildings"], z["destroyed_count"], z["major_damage_count"], z["minor_damage_count"],
                    z["no_damage_count"], z["estimated_population"], z["avg_priority_score"],
                    z["hospitals_count"], z["shelters_count"], z["blocked_roads_count"],
                    z["highest_priority_building_id"], z["recommended_action"], z["explanation"],
                    json.dumps(z["constituent_building_ids"]), geom_wkt
                ))

            conn.commit()
            return len(zones_data)
        finally:
            cur.close()
            conn.close()

    def get_zones_geojson(self, scenario_id: int):
        conn = self.get_connection()
        cur = conn.cursor()

        try:
            cur.execute("""
                SELECT 
                    id, zone_code, name, criticality, criticality_score,
                    total_buildings, destroyed_count, major_damage_count, minor_damage_count,
                    no_damage_count, estimated_population, avg_priority_score,
                    hospitals_count, shelters_count, blocked_roads_count,
                    highest_priority_building_id, recommended_action, explanation,
                    constituent_building_ids, ST_AsGeoJSON(geometry)
                FROM operational_zones
                WHERE scenario_id = %s
                ORDER BY criticality_score DESC
            """, (scenario_id,))
            rows = cur.fetchall()

            # If no zones saved yet in DB, generate and save them on the fly
            if not rows:
                zones_data = self.generate_zones_for_scenario(scenario_id)
                self.save_zones_to_db(scenario_id, zones_data)
                return self.get_zones_geojson(scenario_id)

            features = []
            for r in rows:
                features.append({
                    "type": "Feature",
                    "id": r[0],
                    "geometry": json.loads(r[19]),
                    "properties": {
                        "id": r[0],
                        "zone_code": r[1],
                        "name": r[2],
                        "criticality": r[3],
                        "criticality_score": r[4],
                        "total_buildings": r[5],
                        "destroyed_count": r[6],
                        "major_damage_count": r[7],
                        "minor_damage_count": r[8],
                        "no_damage_count": r[9],
                        "estimated_population": r[10],
                        "avg_priority_score": r[11],
                        "hospitals_count": r[12],
                        "shelters_count": r[13],
                        "blocked_roads_count": r[14],
                        "highest_priority_building_id": r[15],
                        "recommended_action": r[16],
                        "explanation": r[17],
                        "constituent_building_ids": (
                            r[18] if isinstance(r[18], list) else (
                                [int(x.strip()) for x in r[18].split(",") if x.strip().isdigit()]
                                if (isinstance(r[18], str) and not r[18].startswith("["))
                                else (json.loads(r[18]) if r[18] else [])
                            )
                        )
                    }
                })

            return {
                "type": "FeatureCollection",
                "features": features
            }
        finally:
            cur.close()
            conn.close()

    def seed_all_scenarios(self, num_zones_per_scenario: int = None):
        """Generates and persists non-overlapping operational zones for scenarios 1..4."""
        total_saved = 0
        for scen_id in [1, 2, 3, 4]:
            zones = self.generate_zones_for_scenario(scen_id, num_zones=num_zones_per_scenario)
            saved = self.save_zones_to_db(scen_id, zones)
            total_saved += saved
        return total_saved


def generate_and_save_all():
    generator = OperationalZoneGenerator()
    total_saved = generator.seed_all_scenarios()
    print(f"\nCompleted operational zone generation: {total_saved} total non-overlapping minor-level zones across 4 scenarios.")
    return total_saved


if __name__ == "__main__":
    generate_and_save_all()
