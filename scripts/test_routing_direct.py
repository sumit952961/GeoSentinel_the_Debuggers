import requests

AI = 'http://localhost:8000/api/routing/route'

tests = [
    ('Woolsey Responder', {'scenario_id': 1, 'origin_lon': -118.63, 'origin_lat': 34.05, 'route_purpose': 'RESPONSE'}),
    ('Woolsey Evacuation', {'scenario_id': 1, 'origin_lon': -118.63, 'origin_lat': 34.05, 'route_purpose': 'EVACUATION'}),
    ('Chamoli Responder', {'scenario_id': 2, 'origin_lon': 79.62, 'origin_lat': 30.45, 'route_purpose': 'RESPONSE'}),
    ('Chamoli Evacuation', {'scenario_id': 2, 'origin_lon': 79.62, 'origin_lat': 30.45, 'route_purpose': 'EVACUATION'}),
    ('Wayanad Responder', {'scenario_id': 3, 'origin_lon': 76.10, 'origin_lat': 11.47, 'route_purpose': 'RESPONSE'}),
    ('Wayanad Evacuation', {'scenario_id': 3, 'origin_lon': 76.10, 'origin_lat': 11.47, 'route_purpose': 'EVACUATION'}),
    ('Dharali Responder', {'scenario_id': 4, 'origin_lon': 78.75, 'origin_lat': 31.03, 'route_purpose': 'RESPONSE'}),
    ('Dharali Evacuation', {'scenario_id': 4, 'origin_lon': 78.75, 'origin_lat': 31.03, 'route_purpose': 'EVACUATION'}),
]

for name, payload in tests:
    try:
        r = requests.post(AI, json=payload, timeout=10)
        if r.status_code == 200:
            data = r.json()
            dist = data.get('distance_km')
            eta = data.get('eta_minutes')
            avoided = len(data.get('avoided_blocked_roads', []))
            print(f"PASS: {name} -> dist: {dist} km, ETA: {eta} min, avoided: {avoided}")
        else:
            print(f"FAIL: {name} -> HTTP {r.status_code}: {r.text[:120]}")
    except Exception as e:
        print(f"ERROR: {name} -> {e}")
