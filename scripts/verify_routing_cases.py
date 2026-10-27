import os
import sys
import json

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT_DIR, "ai-service"))

from app.routing.router import DisasterGraphRouter

router = DisasterGraphRouter()

print("=" * 70)
print("VERIFYING ROUTING CASES & DETOUR CALCULATIONS (SCENARIO 1)")
print("=" * 70)

# Test Case 1: Route to Nearest Hospital with Roadblock Avoidance (Detour Mode)
r1 = router.calculate_route(
    scenario_id=1,
    origin_lon=-118.685,
    origin_lat=34.052,
    destination_type="hospital",
    avoid_blocked=True
)
print("[Case 1: Route to Nearest Hospital (Detour Mode)]")
print(f"  Success: {r1['success']}")
print(f"  Destination: {r1['summary']['destination_name']} ({r1['summary']['destination_type']}, Beds: {r1['summary'].get('destination_capacity', 'N/A')})")
print(f"  Distance: {r1['summary']['distance_km']} km | Estimated Time: ~{r1['summary']['estimated_minutes']} mins")
print(f"  Calculation Latency: {r1['summary']['calculation_time_ms']} ms")
print(f"  Blocked Roads Avoided ({len(r1['summary']['blocked_roads_avoided'])}): {', '.join(r1['summary']['blocked_roads_avoided'][:2])}...")

# Test Case 2: Route to Nearest Shelter
r2 = router.calculate_route(
    scenario_id=1,
    origin_lon=-118.685,
    origin_lat=34.052,
    destination_type="shelter",
    avoid_blocked=True
)
print("\n[Case 2: Route to Nearest Shelter (Detour Mode)]")
print(f"  Success: {r2['success']}")
print(f"  Destination: {r2['summary']['destination_name']} ({r2['summary']['destination_type']}, Capacity: {r2['summary'].get('destination_capacity', 'N/A')})")
print(f"  Distance: {r2['summary']['distance_km']} km | Estimated Time: ~{r2['summary']['estimated_minutes']} mins")
print(f"  Calculation Latency: {r2['summary']['calculation_time_ms']} ms")

# Test Case 3: Direct Route (Without Roadblock Avoidance) to compare distance delta
r3 = router.calculate_route(
    scenario_id=1,
    origin_lon=-118.685,
    origin_lat=34.052,
    destination_type="hospital",
    avoid_blocked=False
)
print("\n[Case 3: Direct Route vs Detour Comparison]")
print(f"  Direct Distance: {r3['summary']['distance_km']} km (through hazardous/blocked road)")
print(f"  Safe Detour Distance: {r1['summary']['distance_km']} km (routing around blocked corridors)")

print("=" * 70)
