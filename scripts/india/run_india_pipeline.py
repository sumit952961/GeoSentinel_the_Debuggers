"""
============================================================
DRAS — India-Specific Research Master Pipeline Runner
============================================================

Executes the complete end-to-end scientific pipeline:
  1. Source Audit (audit_sources.py)
     - Validates licenses, sensor specs, coordinate validity, and label provenance.
  2. Dataset Preparation (prepare_india_dataset.py)
     - Generates 512x512 multi-spectral chips and 5-class masks.
  3. Model Fine-Tuning (train_india.py)
     - Fine-tunes U-Net ResNet34 on Chamoli 2021 + Cyclone Fani 2019.
  4. Comparative & Generalisation Evaluation (evaluate_india.py)
     - Evaluates Baseline vs India-Tuned across in-domain and zero-shot Dharali 2025.
  5. Operational Zone Generation (zone_generator.py)
     - Clusters building footprints and hazard context into PostGIS operational sectors.
  6. Master Quality Report (outputs/india_quality_report.json)
     - Synthesizes all provenance, data, model, and GIS metrics into a single artifact.

Usage:
  python scripts/india/run_india_pipeline.py
  python scripts/india/run_india_pipeline.py --skip-train
  python scripts/india/run_india_pipeline.py --epochs 3
"""

import os
import sys
import time
import json
import argparse
import subprocess

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.append(ROOT_DIR)
sys.path.append(os.path.join(ROOT_DIR, "ai-service"))


def run_step(step_name: str, func, *args, **kwargs):
    print("\n" + "=" * 70)
    print(f"PIPELINE STEP: {step_name}")
    print("=" * 70)
    t0 = time.time()
    try:
        res = func(*args, **kwargs)
        elapsed = time.time() - t0
        print(f"--> [SUCCESS] {step_name} completed in {elapsed:.2f}s")
        return {"status": "SUCCESS", "elapsed_s": round(elapsed, 2), "data": res}
    except Exception as e:
        elapsed = time.time() - t0
        print(f"--> [ERROR] {step_name} failed: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "FAILED", "elapsed_s": round(elapsed, 2), "error": str(e)}


def step_source_audit():
    from scripts.india.audit_sources import audit_sources
    records = audit_sources()
    print(f"  Audited {len(records)} primary geospatial sources.")
    # Also run empirical data audit if available
    try:
        from scripts.india.generate_data_audit import main as audit_main
        audit_main()
        print("  Generated outputs/india_data_audit.json")
    except Exception as e:
        print(f"  Note on data audit generation: {e}")
    return {"sources_count": len(records), "sources": [r["source_name"] for r in records]}


def step_prepare_dataset():
    from scripts.india.prepare_india_dataset import main as prepare_main
    prepare_main()
    manifest_path = os.path.join(ROOT_DIR, "data", "india", "india_manifest.csv")
    tiles_count = 0
    if os.path.exists(manifest_path):
        with open(manifest_path, "r", encoding="utf-8") as f:
            tiles_count = sum(1 for _ in f) - 1
    print(f"  Verified {tiles_count} tiles in india_manifest.csv.")
    return {"manifest_path": manifest_path, "tile_count": tiles_count}


def step_train_model(epochs: int = 5, batch_size: int = 4, lr: float = 1e-4):
    from scripts.train_india_v2 import train_v2
    log_data = train_v2(epochs=epochs, batch_size=batch_size, lr=lr)
    return {
        "best_epoch": log_data.get("best_epoch"),
        "best_val_loss": log_data.get("best_val_loss"),
        "history": log_data.get("history")
    }


def step_evaluate_model():
    eval_script = os.path.join(ROOT_DIR, "scripts", "evaluate_india.py")
    ret = subprocess.run([sys.executable, eval_script], cwd=ROOT_DIR, capture_output=True, text=True)
    if ret.returncode != 0:
        raise RuntimeError(f"Evaluation failed: {ret.stderr}")
    print(ret.stdout)
    
    res_path = os.path.join(ROOT_DIR, "outputs", "india_evaluation", "comparison.json")
    if os.path.exists(res_path):
        with open(res_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def step_generate_zones():
    from app.analysis.zone_generator import OperationalZoneGenerator
    gen = OperationalZoneGenerator()
    seeded = gen.seed_all_scenarios(num_zones_per_scenario=4)
    print(f"  Seeded {seeded} operational zones across scenarios.")
    return {"total_zones_seeded": seeded}


def main():
    parser = argparse.ArgumentParser(description="DRAS India Research Pipeline Runner")
    parser.add_argument("--skip-train", action="store_true", help="Skip fine-tuning if checkpoint already exists")
    parser.add_argument("--epochs", type=int, default=5, help="Number of fine-tuning epochs")
    parser.add_argument("--batch-size", type=int, default=4, help="Batch size for training")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    args = parser.parse_args()

    overall_start = time.time()
    print("*" * 70)
    print("  STARTING DRAS INDIA RESEARCH MASTER PIPELINE")
    print("*" * 70)

    report = {
        "pipeline_name": "DRAS India Research Pipeline v2.0",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "configuration": {
            "skip_train": args.skip_train,
            "epochs": args.epochs,
            "batch_size": args.batch_size,
            "learning_rate": args.lr
        },
        "steps": {}
    }

    # Step 1: Audit Sources & Generate Data Audit
    report["steps"]["source_audit"] = run_step("Source Audit & Verification", step_source_audit)

    # Step 2: Prepare Dataset
    report["steps"]["dataset_preparation"] = run_step("Dataset Preparation (Chips & Masks)", step_prepare_dataset)

    # Step 3: Model Training
    if args.skip_train:
        print("\n--> [SKIPPED] Model fine-tuning skipped by user flag.")
        report["steps"]["model_training"] = {
            "status": "SKIPPED", 
            "note": "Checkpoints reused: models/india_v1/best_model.pth & models/india_v2/best_model.pth"
        }
    else:
        report["steps"]["model_training"] = run_step(
            "India-Specific Model Fine-Tuning v2 (Class-Weighted)", 
            step_train_model, 
            epochs=args.epochs, 
            batch_size=args.batch_size, 
            lr=args.lr
        )

    # Step 4: Comparative Evaluation
    report["steps"]["evaluation"] = run_step("Comparative & Generalisation Evaluation", step_evaluate_model)

    # Step 5: Operational Zone Generation
    report["steps"]["zone_generation"] = run_step("Operational Zone Spatial Aggregation", step_generate_zones)

    # Compile Quality Highlights from outputs/india_evaluation/comparison.json
    eval_data = report["steps"].get("evaluation", {}).get("data", {})
    overall_m = eval_data.get("overall_metrics", {})
    
    quality_highlights = {
        "models_evaluated": eval_data.get("models_evaluated", ["baseline", "india_v1", "india_v2"]),
        "accuracy_baseline": overall_m.get("accuracy", {}).get("baseline"),
        "accuracy_india_v2": overall_m.get("accuracy", {}).get("india"),
        "accuracy_delta": overall_m.get("accuracy", {}).get("delta"),
        "mean_iou_baseline": overall_m.get("mean_iou", {}).get("baseline"),
        "mean_iou_india_v2": overall_m.get("mean_iou", {}).get("india"),
        "mean_iou_delta": overall_m.get("mean_iou", {}).get("delta"),
        "building_mean_iou_baseline": overall_m.get("building_mean_iou", {}).get("baseline"),
        "building_mean_iou_india_v2": overall_m.get("building_mean_iou", {}).get("india"),
        "macro_f1_baseline": overall_m.get("macro_f1", {}).get("baseline"),
        "macro_f1_india_v2": overall_m.get("macro_f1", {}).get("india"),
        "per_event_eval": eval_data.get("per_event", {}),
        "total_operational_zones": report["steps"].get("zone_generation", {}).get("data", {}).get("total_zones_seeded", 0)
    }
    report["quality_highlights"] = quality_highlights
    report["total_pipeline_duration_s"] = round(time.time() - overall_start, 2)

    # Save outputs/india_quality_report.json
    out_dir = os.path.join(ROOT_DIR, "outputs")
    os.makedirs(out_dir, exist_ok=True)
    report_file = os.path.join(out_dir, "india_quality_report.json")
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print("\n" + "*" * 70)
    print("  MASTER PIPELINE RUN COMPLETE")
    print(f"  Duration: {report['total_pipeline_duration_s']}s")
    print(f"  Quality Report: {report_file}")
    print("*" * 70)
    print(json.dumps(quality_highlights, indent=2))


if __name__ == "__main__":
    main()
