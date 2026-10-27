"""
============================================================
Download Sentinel-2 Imagery for Indian Disaster Scenarios
============================================================

Attempts to download actual pre/post disaster imagery from 
Copernicus Data Space Ecosystem (CDSE) using the free OData API.

Target scenes:
  Chamoli 2021: Pre=2021-02-05, Post=2021-02-10 (clear winter)
  Wayanad 2024: Pre=2024-07-20, Post=2024-08-01 (monsoon - likely cloudy)
  Dharali 2025: Pre/Post dates TBD based on availability

NOTE: Sentinel-2 L2A products require NO account for search, but
downloading requires a free Copernicus Data Space account.
"""

import os
import sys
import json
import requests
from datetime import datetime

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))

CDSE_SEARCH_URL = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"

SCENARIOS = {
    "chamoli_2021": {
        "bbox": [79.55, 30.25, 79.85, 30.55],
        "pre_date_range": ("2021-02-01", "2021-02-06"),
        "post_date_range": ("2021-02-08", "2021-02-15"),
        "max_cloud": 30
    },
    "wayanad_2024": {
        "bbox": [76.04, 11.40, 76.16, 11.55],
        "pre_date_range": ("2024-07-15", "2024-07-28"),
        "post_date_range": ("2024-07-31", "2024-08-10"),
        "max_cloud": 80  # Monsoon - expect high cloud cover
    },
    "dharali_2025": {
        "bbox": [78.60, 30.90, 78.90, 31.15],
        "pre_date_range": ("2025-07-01", "2025-07-14"),
        "post_date_range": ("2025-07-16", "2025-07-30"),
        "max_cloud": 50
    }
}


def search_sentinel2(bbox, date_start, date_end, max_cloud=30):
    """Search Copernicus Data Space for Sentinel-2 L2A products."""
    w, s, e, n = bbox
    footprint = f"OData.CSC.Intersects(area=geography'SRID=4326;POLYGON(({w} {s},{e} {s},{e} {n},{w} {n},{w} {s}))')"
    
    params = {
        "$filter": (
            f"Collection/Name eq 'SENTINEL-2' and "
            f"Attributes/OData.CSC.StringAttribute/any(att:att/Name eq 'productType' and att/OData.CSC.StringAttribute/Value eq 'S2MSI2A') and "
            f"ContentDate/Start gt {date_start}T00:00:00.000Z and "
            f"ContentDate/Start lt {date_end}T23:59:59.999Z and "
            f"Attributes/OData.CSC.DoubleAttribute/any(att:att/Name eq 'cloudCover' and att/OData.CSC.DoubleAttribute/Value le {max_cloud}) and "
            f"{footprint}"
        ),
        "$orderby": "ContentDate/Start asc",
        "$top": 5,
        "$expand": "Attributes"
    }
    
    headers = {"User-Agent": "DRAS-Research/2.0"}
    
    try:
        resp = requests.get(CDSE_SEARCH_URL, params=params, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        return data.get("value", [])
    except Exception as e:
        print(f"  [ERROR] Search failed: {e}")
        return []


def main():
    print("=" * 70)
    print("SENTINEL-2 IMAGERY SEARCH FOR INDIAN DISASTER SCENARIOS")
    print("=" * 70)
    
    all_results = {}
    
    for event_id, config in SCENARIOS.items():
        print(f"\n--- {event_id.upper()} ---")
        bbox = config["bbox"]
        
        # Search pre-disaster
        print(f"  Searching PRE-disaster imagery ({config['pre_date_range'][0]} to {config['pre_date_range'][1]})...")
        pre_results = search_sentinel2(bbox, config["pre_date_range"][0], config["pre_date_range"][1], config["max_cloud"])
        
        # Search post-disaster
        print(f"  Searching POST-disaster imagery ({config['post_date_range'][0]} to {config['post_date_range'][1]})...")
        post_results = search_sentinel2(bbox, config["post_date_range"][0], config["post_date_range"][1], config["max_cloud"])
        
        event_results = {
            "pre_images": [],
            "post_images": [],
            "pre_count": len(pre_results),
            "post_count": len(post_results)
        }
        
        for r in pre_results:
            cloud_attr = [a for a in r.get("Attributes", []) if a.get("Name") == "cloudCover"]
            cloud = cloud_attr[0]["Value"] if cloud_attr else "N/A"
            entry = {
                "id": r.get("Id"),
                "name": r.get("Name"),
                "date": r.get("ContentDate", {}).get("Start", ""),
                "cloud_cover": cloud,
                "size_mb": round(r.get("ContentLength", 0) / 1e6, 1),
                "download_url": f"https://zipper.dataspace.copernicus.eu/odata/v1/Products({r.get('Id')})/$value"
            }
            event_results["pre_images"].append(entry)
            print(f"    PRE: {entry['name']} | Date: {entry['date'][:10]} | Cloud: {cloud}% | Size: {entry['size_mb']}MB")
        
        for r in post_results:
            cloud_attr = [a for a in r.get("Attributes", []) if a.get("Name") == "cloudCover"]
            cloud = cloud_attr[0]["Value"] if cloud_attr else "N/A"
            entry = {
                "id": r.get("Id"),
                "name": r.get("Name"),
                "date": r.get("ContentDate", {}).get("Start", ""),
                "cloud_cover": cloud,
                "size_mb": round(r.get("ContentLength", 0) / 1e6, 1),
                "download_url": f"https://zipper.dataspace.copernicus.eu/odata/v1/Products({r.get('Id')})/$value"
            }
            event_results["post_images"].append(entry)
            print(f"    POST: {entry['name']} | Date: {entry['date'][:10]} | Cloud: {cloud}% | Size: {entry['size_mb']}MB")
        
        if not pre_results:
            print("    [WARNING] No pre-disaster imagery found in date range.")
        if not post_results:
            print("    [WARNING] No post-disaster imagery found in date range.")
        
        all_results[event_id] = event_results
    
    # Save search results
    out_path = os.path.join(ROOT_DIR, "data", "india", "sentinel2_search_results.json")
    with open(out_path, "w") as f:
        json.dump(all_results, f, indent=2, default=str)
    print(f"\n[SAVED] Search results: {out_path}")
    
    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    for eid, res in all_results.items():
        print(f"  {eid}: {res['pre_count']} pre + {res['post_count']} post images found")
    
    print("\n[NOTE] Downloading full Sentinel-2 L2A products requires a free")
    print("Copernicus Data Space account (https://dataspace.copernicus.eu).")
    print("Each product is typically 600-900 MB. Download manually or with")
    print("a valid access token.")


if __name__ == "__main__":
    main()
