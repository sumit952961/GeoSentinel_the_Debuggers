import requests
import json

for sid in [1, 2]:
    try:
        sc = requests.get(f'http://localhost:8081/api/scenarios/{sid}').json()
        dm = requests.get(f'http://localhost:8081/api/map-layers/damages/{sid}').json()
        pr = requests.get(f'http://localhost:8081/api/map-layers/priorities/{sid}').json()
        rd = requests.get(f'http://localhost:8081/api/map-layers/roads/{sid}').json()
        hp = requests.get(f'http://localhost:8081/api/map-layers/hospitals/{sid}').json()
        sh = requests.get(f'http://localhost:8081/api/map-layers/shelters/{sid}').json()
        print(f"Scenario {sid}: {sc.get('name')}")
        print(f"  Description: {sc.get('description')}")
        print(f"  Center: lat={sc.get('centerLat')}, lon={sc.get('centerLon')}")
        print(f"  Damages count: {len(dm.get('features', []))}")
        print(f"  Priorities count: {len(pr.get('features', []))}")
        print(f"  Roads count: {len(rd.get('features', []))}")
        print(f"  Hospitals count: {len(hp.get('features', []))}")
        print(f"  Shelters count: {len(sh.get('features', []))}")

        # Check sample priority
        if pr.get('features'):
            top_pri = sorted(pr['features'], key=lambda f: f.get('properties', {}).get('priorityScore', 0), reverse=True)[0]
            print(f"  Top Priority Structure: id={top_pri['properties'].get('buildingId')}, score={top_pri['properties'].get('priorityScore')}, level={top_pri['properties'].get('priorityLevel')}")
            print(f"  Factors: severity={top_pri['properties'].get('severityScore')}, pop={top_pri['properties'].get('populationScore')}, infra={top_pri['properties'].get('infrastructureScore')}, access={top_pri['properties'].get('accessibilityScore')}")

        # Check hospitals
        if hp.get('features'):
            h_names = [h['properties'].get('name') for h in hp['features'][:3]]
            print(f"  Sample hospitals: {h_names}")

    except Exception as e:
        print(f"Error inspecting scenario {sid}: {e}")
