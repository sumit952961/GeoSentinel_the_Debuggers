import os
import requests

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../data/india/chamoli_2021/annotations'))
os.makedirs(BASE_DIR, exist_ok=True)

# EIDC Westoby et al. Damage Dataset
# DOI: 10.5285/a763e254-c249-4934-b0fb-c3b808b37db6
DATA_URL = "https://catalogue.ceh.ac.uk/datastore/eidchub/a763e254-c249-4934-b0fb-c3b808b37db6/a763e254-c249-4934-b0fb-c3b808b37db6.zip"

def main():
    print("Downloading EIDC Westoby et al. Chamoli damage dataset...")
    print("License: Open Government Licence / UKRI Data Licence")
    try:
        out_path = os.path.join(BASE_DIR, "chamoli_damage.zip")
        response = requests.get(DATA_URL, stream=True)
        if response.status_code == 200:
            with open(out_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            print(f"Saved dataset to {out_path}")
            print("Note: Extract the shapefiles manually or use a standard unzip utility.")
        else:
            print(f"Failed to download dataset. Status code: {response.status_code}")
            print("You may need to download manually from https://catalogue.ceh.ac.uk/documents/a763e254-c249-4934-b0fb-c3b808b37db6")
    except Exception as e:
        print(f"Error downloading chamoli damage data: {e}")

if __name__ == "__main__":
    main()
