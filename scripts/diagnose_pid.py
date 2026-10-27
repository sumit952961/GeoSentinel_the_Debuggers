import subprocess
import time
import os
import datetime
import json

PID = 28024

def get_process_stats(pid):
    cmd = [
        "powershell",
        "-NoProfile",
        "-Command",
        f"Get-Process -Id {pid} -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, Responding, StartTime, CPU, WorkingSet64 | ConvertTo-Json"
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if res.returncode == 0 and res.stdout.strip():
            return json.loads(res.stdout.strip())
    except Exception as e:
        print("Error reading process:", e)
    return None

print(f"Sampling PID {PID} at t0...")
stats1 = get_process_stats(PID)
if not stats1:
    print("PROCESS_NOT_FOUND")
    exit(0)

t1_wall = time.time()
print(f"  t0 CPU Seconds: {stats1.get('CPU', 0):.2f}s | WorkingSet: {stats1.get('WorkingSet64', 0)/(1024*1024):.1f} MB")
print("Waiting exactly 30 seconds...")
time.sleep(30)

stats2 = get_process_stats(PID)
t2_wall = time.time()

if not stats2:
    print("PROCESS_EXITED_DURING_SAMPLE")
    exit(0)

delta_cpu = stats2.get("CPU", 0) - stats1.get("CPU", 0)
delta_wall = t2_wall - t1_wall

json_path = os.path.abspath("ai-service/outputs/stage1_localization_results.json")
pth_path = os.path.abspath("ai-service/models/stage1_building_loc_best.pth")
vis_dir = os.path.abspath("ai-service/outputs/stage1_visuals")
crops_dir = os.path.abspath("ai-service/outputs/stage1_extracted_crops")

print("\n" + "=" * 70)
print("=== PID 28024 DEFINITIVE DIAGNOSTIC MEASUREMENT REPORT ===")
print("=" * 70)
print(f"Process ID:              {PID}")
print(f"Process Name:            {stats2.get('ProcessName')}")
print(f"Process Responding:      {stats2.get('Responding')}")
print(f"Process Start Time:      {stats2.get('StartTime')}")
print(f"Total CPU Seconds:       {stats2.get('CPU'):.2f}s ({stats2.get('CPU')/60:.1f} CPU-minutes)")
print(f"Current WorkingSet (RAM):{stats2.get('WorkingSet64')/(1024*1024):.1f} MB")
print(f"30-Second CPU Delta:     {delta_cpu:.2f} seconds")
print(f"30-Second Wall Delta:    {delta_wall:.2f} seconds")
print(f"Effective CPU Rate:      {delta_cpu / delta_wall:.2f} core-equivalents")

print("\n--- OUTPUT FILES & CHECKPOINTS ---")
print(f"Results JSON Exists:     {os.path.exists(json_path)}")
if os.path.exists(json_path):
    print(f"  JSON File Size:        {os.path.getsize(json_path)} bytes")
    print(f"  JSON Last Modified:    {datetime.datetime.fromtimestamp(os.path.getmtime(json_path))}")
print(f"Best Model PTH Exists:   {os.path.exists(pth_path)}")
if os.path.exists(pth_path):
    print(f"  PTH File Size:         {os.path.getsize(pth_path)} bytes")
    print(f"  PTH Last Modified:     {datetime.datetime.fromtimestamp(os.path.getmtime(pth_path))}")
vis_count = len(os.listdir(vis_dir)) if os.path.exists(vis_dir) else 0
crop_count = len(os.listdir(crops_dir)) if os.path.exists(crops_dir) else 0
print(f"Visual Artifacts Count:  {vis_count} images")
print(f"Extracted Crops Count:   {crop_count} patches")
print("=" * 70)
