import urllib.request
import urllib.parse
import json

aoi = "POLYGON((85.75 19.75, 85.90 19.75, 85.90 19.85, 85.75 19.85, 85.75 19.75))"

query_filter = (
    "Collection/Name eq 'SENTINEL-2' and "
    f"OData.CSC.Intersects(area=geography'SRID=4326;{aoi}') and "
    "ContentDate/Start gt 2019-04-20T00:00:00.000Z and "
    "ContentDate/Start lt 2019-05-02T00:00:00.000Z"
)

params = {
    "$filter": query_filter,
    "$orderby": "ContentDate/Start asc",
    "$top": "20",
    "$expand": "Attributes"
}

url = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products?" + urllib.parse.urlencode(params)

print(f"Querying Copernicus CDSE for Puri (Cyclone Fani)...")
try:
    req = urllib.request.Request(url, headers={"User-Agent": "DRAS-Research"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())
        items = data.get("value", [])
        print(f"Found {len(items)} Sentinel-2 products:")
        for it in items:
            name = it.get("Name")
            date = it.get("ContentDate", {}).get("Start", "")[:10]
            cloud = "N/A"
            for p in it.get("Attributes", []):
                if p.get("Name") == "cloudCover":
                    cloud = f"{p.get('Value'):.1f}"
            print(f"  {date} | Cloud: {cloud:>5}% | {name}")
except Exception as e:
    print(f"Error: {e}")
