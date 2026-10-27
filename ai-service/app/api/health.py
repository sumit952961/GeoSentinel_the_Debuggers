"""
============================================================
Health and Model Info Endpoints
============================================================

Purpose:
  These endpoints let Spring Boot verify that the AI service
  is running and check what model is loaded.

Endpoints:
  GET /health      → Is the AI service alive?
  GET /model/info  → What model is loaded? What device?

How to test:
  Start the service, then visit:
    http://localhost:8000/health
    http://localhost:8000/model/info
"""

import platform
import sys
from datetime import datetime, timezone

import torch
from fastapi import APIRouter

# -------------------------------------------------------
# Create a router (group of related endpoints)
# -------------------------------------------------------
# A router is like a mini-app. We define endpoints here,
# then register this router in main.py with app.include_router().
router = APIRouter()


@router.get("/health")
@router.get("/api/health")
def health_check():
    """
    Simple health check.

    Returns basic info confirming the service is running.
    Spring Boot calls this endpoint to verify connectivity.
    """
    return {
        "status": "UP",
        "service": "disaster-management-ai-service",
        "version": "0.1.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/model/info")
def model_info():
    """
    Report what AI capabilities and checkpoints are available across all model directories.
    """
    import os
    app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ai_models_dir = os.path.join(app_dir, '..', 'models')
    root_models_dir = os.path.join(app_dir, '..', '..', 'models')

    available_weights = []
    for m_dir in [ai_models_dir, root_models_dir]:
        if os.path.exists(m_dir):
            for root, _, files in os.walk(m_dir):
                for f in files:
                    if f.endswith(('.pth', '.pt')):
                        fpath = os.path.join(root, f)
                        rel = os.path.relpath(fpath, os.path.dirname(root_models_dir))
                        available_weights.append({
                            "filename": f,
                            "relative_path": rel.replace('\\', '/'),
                            "size_mb": round(os.path.getsize(fpath) / 1e6, 1)
                        })

    return {
        "model_loaded": len(available_weights) > 0,
        "active_production_model": "dras_india_v3 (Two-Stage Decoupled U-Net++ & Siamese ResNet50)",
        "model_version": "v3.0-decoupled-india",
        "supported_architectures": [
            "DRAS India v3: U-Net++ (EfficientNet-B2) + Siamese ResNet50",
            "DRAS India v2: Class-Weighted U-Net ResNet34",
            "DRAS India v1: Fine-Tuned U-Net ResNet34",
            "Baseline: U-Net ResNet34 (xBD Baseline)"
        ],
        "total_checkpoints_detected": len(available_weights),
        "available_weights": available_weights,
        "pytorch_version": torch.__version__,
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "cuda_available": torch.cuda.is_available(),
        "python_version": sys.version,
        "platform": platform.platform(),
    }
