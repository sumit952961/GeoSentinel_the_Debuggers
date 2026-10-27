import urllib.request
import json

for ep in ['/map/damages?scenarioId=1', '/priorities/geojson?scenarioId=1', '/map/zones?scenarioId=1']:
    try:
        req = urllib.request.urlopen(f'http://localhost:8081/api{ep}')
        data = json.loads(req.read().decode())
        print(f'{ep}: SUCCESS, features={len(data.get("features", []))}')
        if 'zones' in ep:
            for f in data.get('features', []):
                p = f['properties']
                print(f"  Zone: {p.get('name')} | Destroyed: {p.get('destroyedCount')} | Major: {p.get('majorDamageCount')} | Minor: {p.get('minorDamageCount')} | Undamaged: {p.get('noDamageCount')} | Crit: {p.get('criticality')}")
    except Exception as e:
        print(f'{ep}: FAILED ({e})')
