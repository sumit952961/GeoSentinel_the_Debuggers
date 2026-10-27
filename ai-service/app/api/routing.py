"""
============================================================
FastAPI Routing & Priority API Endpoints
============================================================
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
from app.routing.router import DisasterGraphRouter
from app.analysis.priority_engine import PriorityEngine

router = APIRouter(prefix="/api/routing", tags=["Routing & Priority Analysis"])
graph_router = DisasterGraphRouter()


class RouteRequest(BaseModel):
    scenario_id: int = 1
    origin_lon: float
    origin_lat: float
    destination_type: str = "hospital"  # "hospital" or "shelter"
    avoid_blocked: bool = True
    route_purpose: Optional[str] = "EVACUATION"  # "RESPONDER" or "EVACUATION"
    target_building_id: Optional[int] = None


class PriorityRecalculateRequest(BaseModel):
    scenario_id: int = 1
    weights: Optional[Dict[str, float]] = None


@router.post("/route")
async def calculate_route(req: RouteRequest):
    """
    Calculates an optimal emergency route (Responder Access or Evacuation).
    """
    result = graph_router.calculate_route(
        scenario_id=req.scenario_id,
        origin_lon=req.origin_lon,
        origin_lat=req.origin_lat,
        destination_type=req.destination_type,
        avoid_blocked=req.avoid_blocked,
        route_purpose=req.route_purpose or "EVACUATION",
        target_building_id=req.target_building_id
    )
    if not result.get("success", False):
        raise HTTPException(status_code=404, detail=result.get("error", "Route calculation failed."))
    return result


@router.post("/recalculate-priorities")
async def recalculate_priorities(req: PriorityRecalculateRequest):
    """
    Recalculates multi-factor priority scores with custom configurable weights.
    """
    engine = PriorityEngine(weights=req.weights)
    geojson_result = engine.calculate_scenario_priorities(scenario_id=req.scenario_id)
    return geojson_result
