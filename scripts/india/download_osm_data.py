import os
import json
import time
import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Base directory setup
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../data/india'))

SCENARIOS = {
    "chamoli_2021": [79.55, 30.25, 79.85, 30.55],
    "wayanad_2024": [76.04, 11.40, 76.16, 11.55],
    "dharali_2025": [78.60, 30.90, 78.90, 31.15]
}

def query_overpass(query_str):
    retries = 3
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'DRAS-DisasterManagement/2.0 (academic research project)'
    }
    for attempt in range(retries):
        try:
            response = requests.post(OVERPASS_URL, data={'data': query_str}, headers=headers, timeout=60)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error querying Overpass API: {e}. Retrying {attempt + 1}/{retries}...")
            time.sleep(10 * (attempt + 1))
    return None

def main():
    for event, bbox in SCENARIOS.items():
        print(f"Processing OSM data for {event}...")
        
        # Format bbox for overpass: south, west, north, east
        bbox_str = f"{bbox[1]},{bbox[0]},{bbox[3]},{bbox[2]}"
        
        # We need buildings, roads, hospitals, shelters, rivers
        query = f"""
        [out:json][timeout:50];
        (
          way["building"]({bbox_str});
          way["highway"]({bbox_str});
          node["amenity"="hospital"]({bbox_str});
          way["amenity"="hospital"]({bbox_str});
          node["amenity"="shelter"]({bbox_str});
          node["building"="school"]({bbox_str});
          way["building"="school"]({bbox_str});
          way["waterway"~"river|stream"]({bbox_str});
        """
        
        if event == "wayanad_2024":
            query += f"""
          way["disaster:damage"]({bbox_str});
          node["disaster:damage"]({bbox_str});
            """
            
        query += f"""
        );
        out body;
        >;
        out skel qt;
        """
        
        data = query_overpass(query)
        if data:
            out_dir = os.path.join(BASE_DIR, event, 'geojson')
            os.makedirs(out_dir, exist_ok=True)
            out_path = os.path.join(out_dir, 'osm_data.json')
            with open(out_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"Saved OSM data to {out_path}")
        else:
            print(f"Failed to fetch data for {event}")
            
if __name__ == "__main__":
    main()
