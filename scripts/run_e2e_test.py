"""
============================================================
End-to-End Integration Test for ALL Scenarios
============================================================

Tests every endpoint and functionality across all 4 scenarios.
Validates: scenarios, map layers, damage, hospitals, shelters,
roads, priorities, routing, reports, evaluation API.
"""

import requests
import json
import time
import sys

BACKEND = "http://localhost:8081/api"
AI_SERVICE = "http://localhost:8000"
SCENARIOS = [1, 2, 3, 4]
SCENARIO_NAMES = {1: "Woolsey Fire", 2: "Chamoli Flash Flood", 3: "Cyclone Fani", 4: "Dharali Flash Flood"}

passed = 0
failed = 0
warnings = 0
results = []

def test(name, func):
    global passed, failed, warnings
    try:
        result = func()
        if result is True:
            print(f"  [PASS] {name}")
            passed += 1
            results.append({"test": name, "status": "PASS"})
        elif result == "WARN":
            print(f"  [WARN] {name}")
            warnings += 1
            results.append({"test": name, "status": "WARN"})
        else:
            print(f"  [FAIL] {name} -> {result}")
            failed += 1
            results.append({"test": name, "status": "FAIL", "detail": str(result)})
    except Exception as e:
        print(f"  [FAIL] {name} -> Exception: {e}")
        failed += 1
        results.append({"test": name, "status": "FAIL", "detail": str(e)})


def run_tests():
    print("=" * 70)
    print("END-TO-END INTEGRATION TEST")
    print("=" * 70)

    # ---- SERVICE HEALTH ----
    print("\n--- Service Health ---")
    test("Backend health", lambda: requests.get(f"{BACKEND}/health", timeout=5).status_code == 200)
    test("AI service health", lambda: requests.get(f"{AI_SERVICE}/health", timeout=5).status_code == 200)
    test("AI model info", lambda: requests.get(f"{AI_SERVICE}/model/info", timeout=5).json().get("model_loaded") is True)

    # ---- SCENARIO LISTING ----
    print("\n--- Scenarios ---")
    def test_scenarios():
        r = requests.get(f"{BACKEND}/scenarios", timeout=5)
        data = r.json()
        if len(data) < 4:
            return f"Expected 4 scenarios, got {len(data)}"
        return True
    test("List all scenarios (expect 4)", test_scenarios)

    # ---- PER-SCENARIO TESTS ----
    for sid in SCENARIOS:
        sname = SCENARIO_NAMES.get(sid, f"Scenario {sid}")
        print(f"\n--- {sname} (ID={sid}) ---")

        # Scenario details
        test(f"[{sid}] Scenario detail", lambda sid=sid: requests.get(f"{BACKEND}/scenarios/{sid}", timeout=5).status_code == 200)

        # Map layers: damages
        def test_damages(sid=sid):
            r = requests.get(f"{BACKEND}/map/damages", params={"scenarioId": sid}, timeout=10)
            if r.status_code != 200:
                return f"HTTP {r.status_code}"
            data = r.json()
            features = data.get("features", [])
            if len(features) == 0:
                return f"No damage features"
            return True
        test(f"[{sid}] Damage predictions GeoJSON", test_damages)

        # Map layers: buildings
        def test_buildings(sid=sid):
            r = requests.get(f"{BACKEND}/map/buildings", params={"scenarioId": sid}, timeout=10)
            if r.status_code != 200:
                return f"HTTP {r.status_code}"
            features = r.json().get("features", [])
            return True if len(features) > 0 else f"No building features"
        test(f"[{sid}] Buildings GeoJSON", test_buildings)

        # Map layers: roads
        def test_roads(sid=sid):
            r = requests.get(f"{BACKEND}/map/roads", params={"scenarioId": sid}, timeout=10)
            if r.status_code != 200:
                return f"HTTP {r.status_code}"
            features = r.json().get("features", [])
            return True if len(features) > 0 else f"No road features"
        test(f"[{sid}] Roads GeoJSON", test_roads)

        # Map layers: hospitals
        def test_hospitals(sid=sid):
            r = requests.get(f"{BACKEND}/map/hospitals", params={"scenarioId": sid}, timeout=10)
            if r.status_code != 200:
                return f"HTTP {r.status_code}"
            features = r.json().get("features", [])
            return True if len(features) > 0 else f"No hospital features"
        test(f"[{sid}] Hospitals GeoJSON", test_hospitals)

        # Map layers: shelters
        def test_shelters(sid=sid):
            r = requests.get(f"{BACKEND}/map/shelters", params={"scenarioId": sid}, timeout=10)
            if r.status_code != 200:
                return f"HTTP {r.status_code}"
            features = r.json().get("features", [])
            return True if len(features) > 0 else f"No shelter features"
        test(f"[{sid}] Shelters GeoJSON", test_shelters)

        # Map layers: operational zones (Backend)
        def test_zones(sid=sid):
            r = requests.get(f"{BACKEND}/map/zones", params={"scenarioId": sid}, timeout=10)
            if r.status_code != 200:
                return f"HTTP {r.status_code}"
            features = r.json().get("features", [])
            return True if len(features) > 0 else f"No operational zone features"
        test(f"[{sid}] Operational Zones GeoJSON (Backend)", test_zones)

        # Map layers: operational zones (AI Service)
        def test_ai_zones(sid=sid):
            r = requests.get(f"{AI_SERVICE}/api/zones", params={"scenario_id": sid}, timeout=10)
            if r.status_code != 200:
                return f"HTTP {r.status_code}"
            features = r.json().get("features", [])
            return True if len(features) > 0 else f"No AI zone features"
        test(f"[{sid}] Operational Zones GeoJSON (AI Service)", test_ai_zones)

        # Scenario boundary
        def test_boundary(sid=sid):
            r = requests.get(f"{BACKEND}/scenarios/{sid}", timeout=10)
            if r.status_code != 200:
                return f"HTTP {r.status_code}"
            return True
        test(f"[{sid}] Boundary/Scenario data", test_boundary)

        # Priority analysis
        def test_priority(sid=sid):
            r = requests.get(f"{BACKEND}/priorities", params={"scenarioId": sid}, timeout=15)
            if r.status_code != 200:
                return f"HTTP {r.status_code}"
            data = r.json()
            if not isinstance(data, list) or len(data) == 0:
                return f"No priority records returned"
            return True
        test(f"[{sid}] Priority analysis", test_priority)

        # Report generation
        def test_report(sid=sid):
            r = requests.get(f"{BACKEND}/reports/{sid}", timeout=10)
            if r.status_code != 200:
                return f"HTTP {r.status_code}"
            data = r.json()
            required_keys = ["scenario", "damage", "buildings", "facilities", "roads", "damages"]
            missing = [k for k in required_keys if k not in data]
            if missing:
                return f"Missing report sections: {missing}"
            return True
        test(f"[{sid}] Report generation", test_report)

    # ---- ROUTING TESTS ----
    print("\n--- Routing ---")

    # 1. Woolsey Fire
    def test_woolsey_responder():
        r = requests.post(f"{AI_SERVICE}/api/routing/route", json={
            "scenario_id": 1, "origin_lon": -118.63, "origin_lat": 34.05, "route_purpose": "RESPONSE"
        }, timeout=15)
        if r.status_code != 200:
            return f"HTTP {r.status_code}"
        return True if r.json().get("success") else r.json().get("error", "Route failed")
    test("Responder route (Woolsey)", test_woolsey_responder)

    def test_woolsey_evac():
        r = requests.post(f"{AI_SERVICE}/api/routing/route", json={
            "scenario_id": 1, "origin_lon": -118.63, "origin_lat": 34.05, "route_purpose": "EVACUATION"
        }, timeout=15)
        if r.status_code != 200:
            return f"HTTP {r.status_code}"
        return True if r.json().get("success") else "WARN"
    test("Evacuation route (Woolsey)", test_woolsey_evac)

    # 2. Chamoli Flash Flood (Indian Scenario)
    def test_chamoli_responder():
        r = requests.post(f"{AI_SERVICE}/api/routing/route", json={
            "scenario_id": 2, "origin_lon": 79.62, "origin_lat": 30.45, "route_purpose": "RESPONSE"
        }, timeout=15)
        if r.status_code != 200:
            return f"HTTP {r.status_code}: {r.text}"
        data = r.json()
        return True if data.get("success") else data.get("error", "Route failed")
    test("Responder route (Chamoli)", test_chamoli_responder)

    def test_chamoli_evac():
        r = requests.post(f"{AI_SERVICE}/api/routing/route", json={
            "scenario_id": 2, "origin_lon": 79.62, "origin_lat": 30.45, "route_purpose": "EVACUATION"
        }, timeout=15)
        if r.status_code != 200:
            return f"HTTP {r.status_code}: {r.text}"
        data = r.json()
        return True if data.get("success") else "WARN"
    test("Evacuation route (Chamoli)", test_chamoli_evac)

    # 3. Cyclone Fani (Indian Scenario)
    def test_fani_responder():
        r = requests.post(f"{AI_SERVICE}/api/routing/route", json={
            "scenario_id": 3, "origin_lon": 85.83, "origin_lat": 19.81, "route_purpose": "RESPONSE"
        }, timeout=15)
        if r.status_code != 200:
            return f"HTTP {r.status_code}: {r.text}"
        data = r.json()
        return True if data.get("success") else data.get("error", "Route failed")
    test("Responder route (Cyclone Fani)", test_fani_responder)

    def test_fani_evac():
        r = requests.post(f"{AI_SERVICE}/api/routing/route", json={
            "scenario_id": 3, "origin_lon": 85.83, "origin_lat": 19.81, "route_purpose": "EVACUATION"
        }, timeout=15)
        if r.status_code != 200:
            return f"HTTP {r.status_code}: {r.text}"
        data = r.json()
        return True if data.get("success") else "WARN"
    test("Evacuation route (Cyclone Fani)", test_fani_evac)

    # 4. Dharali Flash Flood (Indian Scenario)
    def test_dharali_responder():
        r = requests.post(f"{AI_SERVICE}/api/routing/route", json={
            "scenario_id": 4, "origin_lon": 78.75, "origin_lat": 31.03, "route_purpose": "RESPONSE"
        }, timeout=15)
        if r.status_code != 200:
            return f"HTTP {r.status_code}: {r.text}"
        data = r.json()
        return True if data.get("success") else data.get("error", "Route failed")
    test("Responder route (Dharali)", test_dharali_responder)

    def test_dharali_evac():
        r = requests.post(f"{AI_SERVICE}/api/routing/route", json={
            "scenario_id": 4, "origin_lon": 78.75, "origin_lat": 31.03, "route_purpose": "EVACUATION"
        }, timeout=15)
        if r.status_code != 200:
            return f"HTTP {r.status_code}: {r.text}"
        data = r.json()
        return True if data.get("success") else "WARN"
    test("Evacuation route (Dharali)", test_dharali_evac)

    # ---- EVALUATION & RESEARCH API ----
    print("\n--- Evaluation & Research API ---")
    test("Baseline metrics endpoint", lambda: requests.get(f"{AI_SERVICE}/api/evaluation/baseline", timeout=5).status_code == 200)
    test("Comparison endpoint", lambda: requests.get(f"{AI_SERVICE}/api/evaluation/comparison", timeout=5).status_code == 200)
    test("Cross-event evaluation endpoint", lambda: requests.get(f"{AI_SERVICE}/api/evaluation/cross-event", timeout=5).status_code == 200)
    test("Models registry", lambda: requests.get(f"{AI_SERVICE}/api/models", timeout=5).status_code == 200)

    def test_baseline_metrics():
        r = requests.get(f"{AI_SERVICE}/api/evaluation/baseline", timeout=5)
        data = r.json()
        metrics = data.get("metrics", {})
        if "overall_accuracy" not in metrics:
            return "No overall_accuracy in metrics"
        if "confusion_matrix" not in metrics:
            return "No confusion_matrix"
        if "per_class" not in metrics:
            return "No per_class metrics"
        return True
    test("Baseline metrics contain real data", test_baseline_metrics)

    def test_india_v2_model_registered():
        r = requests.get(f"{AI_SERVICE}/api/models", timeout=5)
        data = r.json()
        models = data.get("models", [])
        v2 = next((m for m in models if m.get("id") == "india_tuned_v2"), None)
        if not v2:
            return "india_tuned_v2 not found in models registry"
        if not v2.get("weights_exist"):
            return "india_tuned_v2 checkpoint does not exist on disk"
        return True
    test("Model registry includes verified india_tuned_v2 checkpoint", test_india_v2_model_registered)

    def test_cross_event_disclosure():
        r = requests.get(f"{AI_SERVICE}/api/evaluation/cross-event", timeout=5)
        data = r.json()
        if data.get("test_event") != "dharali_2025":
            return f"Expected dharali_2025, got {data.get('test_event')}"
        if "delta_miou" not in data:
            return "delta_miou missing from cross-event response"
        return True
    test("Cross-event evaluation returns Dharali 2025 generalisation transfer metrics", test_cross_event_disclosure)

    # ---- INDIA-SPECIFIC SCIENTIFIC ARTIFACTS ----
    print("\n--- Scientific Artifacts & Provenance Verification ---")
    import os

    def test_data_audit_artifact():
        path = "outputs/india_data_audit.json"
        if not os.path.exists(path):
            return f"File {path} not found"
        with open(path, "r", encoding="utf-8") as f:
            audit = json.load(f)
        scenarios = audit.get("scenarios", {})
        total_datasets = sum(len(v) for v in scenarios.values())
        if total_datasets < 6:
            return f"Expected >= 6 audited datasets, got {total_datasets}"
        for req in ["chamoli_2021", "fani_2019", "dharali_2025"]:
            if req not in scenarios:
                return f"Scenario {req} missing in data audit"
        return True
    test("Data audit artifact (outputs/india_data_audit.json) verified", test_data_audit_artifact)

    def test_imagery_registry_artifact():
        path = "data/india/imagery_registry.json"
        if not os.path.exists(path):
            return f"File {path} not found"
        with open(path, "r", encoding="utf-8") as f:
            registry = json.load(f)
        scenarios = registry.get("scenarios", {})
        for req in ["chamoli_2021", "fani_2019", "dharali_2025"]:
            if req not in scenarios:
                return f"Scenario {req} missing from imagery registry"
        return True
    test("Imagery registry artifact (data/india/imagery_registry.json) verified", test_imagery_registry_artifact)

    def test_model_diagnosis_artifact():
        path = "outputs/model_diagnosis.md"
        if not os.path.exists(path):
            return f"File {path} not found"
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()
        if len(text) < 1000:
            return "Diagnosis document is too short"
        if "Physical GSD" not in text and "Class Imbalance" not in text:
            return "Diagnosis missing key analytical sections"
        return True
    test("Model diagnosis report (outputs/model_diagnosis.md) verified", test_model_diagnosis_artifact)

    # ---- FAILURE CASES ----
    print("\n--- Failure Cases ---")
    test("Non-existent scenario returns 404", lambda: requests.get(f"{BACKEND}/scenarios/999", timeout=5).status_code == 404)
    test("Report for non-existent scenario", lambda: requests.get(f"{BACKEND}/reports/999", timeout=5).status_code == 404)

    # ---- SUMMARY ----
    print("\n" + "=" * 70)
    print(f"RESULTS: {passed} passed, {failed} failed, {warnings} warnings")
    print(f"Total: {passed + failed + warnings} tests")
    print("=" * 70)

    # Save results
    import os
    os.makedirs("outputs/tests", exist_ok=True)
    with open("outputs/tests/e2e_results.json", "w") as f:
        json.dump({
            "passed": passed, "failed": failed, "warnings": warnings,
            "total": passed + failed + warnings,
            "results": results,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
        }, f, indent=2)
    print(f"Saved to outputs/tests/e2e_results.json")

    return failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
