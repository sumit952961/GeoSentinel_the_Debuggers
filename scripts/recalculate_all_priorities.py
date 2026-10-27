import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'ai-service'))
from app.analysis.priority_engine import PriorityEngine

print("=" * 60)
print("RECALCULATING PRIORITIES FOR ALL SCENARIOS")
print("=" * 60)

for sid in [1, 2, 3, 4]:
    engine = PriorityEngine()
    res = engine.calculate_scenario_priorities(scenario_id=sid)
    features = res.get("features", [])
    summary = res.get("summary", {})
    print(f"Scenario {sid}: {len(features)} priority assessments calculated.")
    print(f"  Summary: {summary}")

print("Done!")
