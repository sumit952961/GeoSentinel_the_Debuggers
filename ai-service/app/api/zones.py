"""
============================================================
FastAPI Operational Zones Endpoint Router
============================================================

Endpoints:
  - GET  /api/zones?scenario_id={id}  -> Returns GeoJSON FeatureCollection of operational zones
  - POST /api/zones/generate?scenario_id={id} -> Forces recalculation and returns updated GeoJSON
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.analysis.zone_generator import OperationalZoneGenerator

router = APIRouter(prefix="/api/zones", tags=["Operational Zones"])
generator = OperationalZoneGenerator()


@router.get("")
def get_zones(scenario_id: int = Query(1, description="Scenario ID")):
    """Returns GeoJSON FeatureCollection of operational zones for the specified scenario."""
    try:
        geojson = generator.get_zones_geojson(scenario_id)
        return geojson
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch operational zones: {str(e)}")


@router.post("/generate")
def generate_zones(scenario_id: int = Query(1, description="Scenario ID"), num_zones: Optional[int] = Query(None)):
    """Recalculates operational zones and stores them in PostGIS."""
    try:
        k = num_zones if num_zones else (3 if scenario_id in [2, 4] else 4)
        zones_data = generator.generate_zones_for_scenario(scenario_id, num_zones=k)
        generator.save_zones_to_db(scenario_id, zones_data)
        return generator.get_zones_geojson(scenario_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate operational zones: {str(e)}")
