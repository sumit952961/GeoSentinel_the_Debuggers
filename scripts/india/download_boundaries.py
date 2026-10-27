import os
import requests

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../data/india/common/boundaries'))
os.makedirs(BASE_DIR, exist_ok=True)

URLS = {
    "states": "https://raw.githubusercontent.com/datameet/maps/master/States/Admin2.geojson",
    "districts": "https://raw.githubusercontent.com/datameet/maps/master/Districts/Census_2011/2011_Dist.geojson"
}

def main():
    print("Downloading India boundaries from Datameet GitHub (License: CC-BY-SA 2.5 IN)...")
    for name, url in URLS.items():
        try:
            print(f"Downloading {name} from {url}...")
            response = requests.get(url)
            if response.status_code == 200:
                out_path = os.path.join(BASE_DIR, f"{name}.geojson")
                with open(out_path, 'w', encoding='utf-8') as f:
                    f.write(response.text)
                print(f"Saved {name} to {out_path}")
            else:
                print(f"Failed to download {name}, status code: {response.status_code}")
        except Exception as e:
            print(f"Error downloading {name}: {e}")

if __name__ == "__main__":
    main()
