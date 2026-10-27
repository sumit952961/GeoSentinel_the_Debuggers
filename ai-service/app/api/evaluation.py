"""
============================================================
Evaluation & Model Registry Endpoints
============================================================

Serves actual evaluation metrics from saved JSON files.
Provides model version information and comparison results.

Endpoints:
  GET /api/models                 -> List available models
  GET /api/models/{model_id}/metrics -> Get evaluation metrics
  GET /api/evaluation/baseline    -> Baseline xBD metrics
  GET /api/evaluation/comparison  -> Baseline vs India-tuned
  GET /api/evaluation/cross-event -> Cross-event experiment results
"""

import os
import json
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api", tags=["evaluation"])

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
EVAL_DIR = os.path.join(ROOT_DIR, 'outputs', 'india_evaluation')
MODELS_DIR = os.path.join(ROOT_DIR, 'ai-service', 'models')

# Model registry - what we actually have
MODEL_REGISTRY = {
    "xbd_baseline_pre_post": {
        "id": "xbd_baseline_pre_post",
        "name": "xBD Baseline (Pre+Post)",
        "architecture": "U-Net ResNet34",
        "training_data": "xBD v2 subset (68 pairs, 5 global disasters)",
        "parameters": 24_446_357,
        "input_mode": "pre_post",
        "num_classes": 5,
        "weights_file": os.path.join("ai-service", "models", "unet_resnet34_pre_post.pth"),
        "status": "available"
    },
    "xbd_baseline_post_only": {
        "id": "xbd_baseline_post_only",
        "name": "xBD Baseline (Post-Only)",
        "architecture": "U-Net ResNet34",
        "training_data": "xBD v2 subset (68 pairs, 5 global disasters)",
        "parameters": 24_446_357,
        "input_mode": "post_only",
        "num_classes": 5,
        "weights_file": os.path.join("ai-service", "models", "unet_resnet34_post_only.pth"),
        "status": "available"
    },
    "india_tuned_v1": {
        "id": "india_tuned_v1",
        "name": "India-Tuned v1 (Experiment 0)",
        "architecture": "U-Net ResNet34 (Unweighted Fine-Tuning)",
        "training_data": "Chamoli 2021 (NERC EIDC) + Cyclone Fani 2019 (Copernicus EMSR357)",
        "parameters": 24_446_357,
        "input_mode": "pre_post",
        "num_classes": 5,
        "weights_file": os.path.join("models", "india_v1", "best_model.pth"),
        "status": "available"
    },
    "india_tuned_v2": {
        "id": "india_tuned_v2",
        "name": "India-Tuned v2 (Experiment 1: Class-Weighted)",
        "architecture": "U-Net ResNet34 (Balanced Loss)",
        "training_data": "Chamoli 2021 + Cyclone Fani 2019 (Class-Weighted CE + Cosine LR)",
        "parameters": 24_446_357,
        "input_mode": "pre_post",
        "num_classes": 5,
        "weights_file": os.path.join("models", "india_v2", "best_model.pth"),
        "status": "available"
    },
    "india_tuned_v3": {
        "id": "india_tuned_v3",
        "name": "India-Tuned v3 (Experiment 3: Two-Stage Decoupled & Native Semantics)",
        "architecture": "Two-Stage Architecture (Stage 1 Localization + Stage 2 Native Footprint Classification)",
        "training_data": "Chamoli 2021 (NERC EIDC Native Binary) + Cyclone Fani 2019 (EMSR357 Points) + Manual Subset (166 bldgs)",
        "parameters": 24_446_357,
        "input_mode": "two_stage_pre_post",
        "num_classes": 2,
        "weights_file": os.path.join("models", "india_v2", "best_model.pth"),
        "status": "available"
    },
    "dras_india_v3": {
        "id": "dras_india_v3",
        "name": "DRAS India Model V3 (Multimodal Optical+SAR & U-Net++)",
        "architecture": "Two-Stage Architecture: Stage 1 U-Net++ EfficientNet-B2 (84.6% IoU) + Stage 2 Multimodal Optical-SAR (78.1% Macro F1, 86.8% Weighted F1)",
        "training_data": "Global (xBD + BRIGHT) + 12 Indian Disaster Events (54,478 catalogued structures)",
        "parameters": 21_864_951,
        "input_mode": "multimodal_pre_post",
        "num_classes": 4,
        "weights_file": os.path.join("models", "india_v3", "stage1", "best_model.pt"),
        "status": "available",
        "model_version": "dras-india-v3",
        "dataset_version": "india-disaster-v3.1",
        "benchmarks": {
            "building_iou": 0.846,
            "dice": 0.908,
            "macro_f1": 0.781,
            "weighted_f1": 0.868,
            "destroyed_f1": 0.812
        }
    }
}


def _load_json(filename):
    """Load a JSON file from the evaluation directory."""
    path = os.path.join(EVAL_DIR, filename)
    if not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


@router.get("/models")
def list_models():
    """List all registered models with availability status."""
    models = []
    for mid, info in MODEL_REGISTRY.items():
        wpath = os.path.join(ROOT_DIR, info["weights_file"]) if info.get("weights_file") else None
        info_copy = dict(info)
        info_copy["weights_exist"] = os.path.exists(wpath) if wpath else False
        if info_copy["weights_exist"]:
            info_copy["weights_size_mb"] = round(os.path.getsize(wpath) / 1e6, 1)
        models.append(info_copy)
    return {"models": models, "count": len(models)}


@router.get("/evaluation/baseline")
def get_baseline_metrics():
    """Return actual baseline evaluation metrics from the xBD test set."""
    data = _load_json("baseline_xbd_metrics.json")
    if not data:
        raise HTTPException(404, "Baseline evaluation has not been run yet.")
    return data


@router.get("/evaluation/comparison")
def get_comparison():
    """Compare baseline vs India-tuned model metrics."""
    comp_data = _load_json("baseline_vs_india.json")
    if comp_data and "baseline" in comp_data and "india_tuned" in comp_data:
        b = comp_data["baseline"]
        i = comp_data["india_tuned"]
        delta = {
            "overall_accuracy": i["overall_accuracy"] - b["overall_accuracy"],
            "mean_iou": i["mean_iou"] - b["mean_iou"],
            "macro_f1": i["macro_f1"] - b["macro_f1"],
            "building_mean_iou": i["building_mean_iou"] - b["building_mean_iou"],
        }
        return {
            "baseline": b,
            "india_tuned": i,
            "delta": delta,
            "comparison_available": True,
            "per_event": {
                "baseline": b.get("per_event", {}),
                "india_tuned": i.get("per_event", {})
            }
        }

    # Fallback to separate files if needed
    baseline = _load_json("baseline_xbd_metrics.json")
    india = _load_json("india_tuned_metrics.json")

    result = {
        "baseline": baseline,
        "india_tuned": india,
        "comparison_available": baseline is not None and india is not None
    }

    if result["comparison_available"]:
        bm = baseline["metrics"]
        im = india["metrics"]
        result["delta"] = {
            "overall_accuracy": im["overall_accuracy"] - bm["overall_accuracy"],
            "mean_iou": im["mean_iou"] - bm["mean_iou"],
            "macro_f1": im["macro_f1"] - bm["macro_f1"],
            "building_mean_iou": im["building_mean_iou"] - bm["building_mean_iou"],
        }
    else:
        result["note"] = "India-tuned model has not been trained yet. Only baseline metrics are available."

    return result


@router.get("/evaluation/cross-event")
def get_cross_event():
    """Return cross-event generalisation experiment results."""
    comp_data = _load_json("baseline_vs_india.json")
    if comp_data and "india_tuned" in comp_data:
        per_ev = comp_data["india_tuned"].get("per_event", {})
        baseline_ev = comp_data["baseline"].get("per_event", {})
        if "dharali_2025" in per_ev:
            return {
                "status": "completed",
                "test_event": "dharali_2025",
                "training_events": ["chamoli_2021", "fani_2019"],
                "scientific_disclosure": "Dharali 2025 has zero verified building-by-building ground-truth damage labels. Quantitative building damage metrics are N/A. Evaluated strictly as qualitative zero-shot inference on an unseen disaster scenario.",
                "quantitative_damage_metrics": "N/A",
                "qualitative_zero_shot": "Available (20 ha ISRO debris fan overlay & operational zone generation)",
                "baseline_metrics": baseline_ev.get("dharali_2025", {}),
                "india_tuned_metrics": per_ev["dharali_2025"],
                "delta_miou": per_ev["dharali_2025"]["mean_iou"] - baseline_ev.get("dharali_2025", {}).get("mean_iou", 0),
                "delta_building_miou": per_ev["dharali_2025"]["building_mean_iou"] - baseline_ev.get("dharali_2025", {}).get("building_mean_iou", 0),
                "note": "qualitative zero-shot inference on an unseen disaster scenario."
            }

    return {
        "status": "not_run",
        "note": "Cross-event experiment requires trained India model."
    }


# ============================================================
# DRAS Model V3 Dedicated Endpoints
# ============================================================

@router.get("/evaluation/v3/benchmarks")
def get_v3_benchmarks():
    """Returns empirical Stage 1 and Stage 2 architectural benchmark metrics."""
    s1 = _load_json("stage1_benchmark.json") or {}
    s2 = _load_json("stage2_benchmark.json") or {}
    return {
        "framework": "DRAS India Model V3 Architecture Benchmarking",
        "stage1_localisation": s1,
        "stage2_damage_assessment": s2
    }


@router.get("/evaluation/v3/ablations")
def get_v3_ablations():
    """Returns the 10-experiment controlled ablation study findings."""
    abl = _load_json("ablation_results.json")
    if not abl:
        raise HTTPException(404, "Ablation results have not been generated yet.")
    return abl


@router.get("/evaluation/v3/cross-event")
def get_v3_cross_event_matrix():
    """Returns the strict leave-one-event-out cross-event generalisation matrix."""
    matrix = _load_json("cross_event_matrix.json")
    if not matrix:
        raise HTTPException(404, "Cross-event matrix has not been generated yet.")
    return matrix


@router.get("/evaluation/v3/active-learning")
def get_v3_active_learning():
    """Returns the active learning uncertainty sampling queue."""
    al_path = os.path.join(ROOT_DIR, "outputs", "active_learning", "smoke_test_uncertainty_queue.json")
    if os.path.exists(al_path):
        with open(al_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"status": "EMPTY", "review_queue": []}


@router.get("/evaluation/v3/quality-control")
def get_v3_quality_control():
    """Returns the 10-check scientific integrity and quality control report."""
    qc = _load_json("quality_control_report.json")
    if not qc:
        raise HTTPException(404, "Quality control report not found.")
    return qc


@router.get("/evaluation/v3/error-analysis")
def get_v3_error_analysis():
    """Returns the model error taxonomy and failure mode breakdown."""
    err = _load_json("error_analysis.json")
    if not err:
        raise HTTPException(404, "Error analysis report not found.")
    return err

