"""
============================================================
FastAPI AI Service — Main Entry Point
============================================================
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import health, cv, routing, evaluation, zones

app = FastAPI(
    title="Disaster Management AI Service",
    description=(
        "Computer Vision and routing service for the "
        "Disaster Management System. Handles image preprocessing, "
        "damage prediction, and route planning."
    ),
    version="0.2.0",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(health.router)
app.include_router(cv.router)
app.include_router(routing.router)
app.include_router(evaluation.router)
app.include_router(zones.router)
