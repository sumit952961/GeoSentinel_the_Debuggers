import asyncio
import os
import subprocess
import json
import imageio_ffmpeg
import edge_tts

VOICE = "en-US-ChristopherNeural"
RATE = "+4%"

DUAL_MASTER_SCENES = [
    {
        "id": "scene01_hook_overview",
        "title": "Act I: Platform Overview & Autonomous Pipeline",
        "text": "In major disasters, rapid situational intelligence saves lives. This is the AI-Driven Disaster Response System—a unified geospatial intelligence platform engineered to assess structural damage, prioritize relief, and navigate emergency response through an autonomous three-stage pipeline: Assess, Prioritise, and Respond."
    },
    {
        "id": "scene02_wildfire_3d_globe",
        "title": "Act II: 3D Earth Globe - Topographic Wildfire Assessment",
        "text": "We begin in full three-dimensional space on our Cesium Earth engine, analyzing the Woolsey Wildfire across California's Santa Monica Mountains. The 3D globe combines high-resolution satellite imagery with elevation terrain models, allowing commanders to inspect canyon slopes, windward ridges, and operational response sectors across complex topography."
    },
    {
        "id": "scene03_wildfire_3d_buildings",
        "title": "Act II: Deep Zoom on 3D Building Extrusions",
        "text": "Zooming directly into the mountain canyon, individual building footprints are extruded in 3D and color-coded across four standardized damage tiers. Red highlights totally destroyed structures, orange indicates major damage, yellow minor damage, and green intact buildings. Selecting a structure slides open its satellite evidence card, displaying pre- and post-disaster optical comparisons and structural damage probability."
    },
    {
        "id": "scene04_chamoli_2d_transition",
        "title": "Act III: 2D GIS Operations Map - Himalayan Flash Flood",
        "text": "For tactical precision in rugged terrain, commanders can transition instantly to our 2D GIS Operations Map. Here, we evaluate the catastrophic Chamoli Flash Flood in Uttarakhand, India, where an ice and rock avalanche triggered devastating torrents through the Rishiganga and Dhauliganga valleys."
    },
    {
        "id": "scene05_chamoli_deep_zoom_assess",
        "title": "Act III: Deep Zoom on Riverbed Structures & Ground Truth",
        "text": "Zooming deep into the Himalayan riverbed, our system isolates vulnerable structures along the flood plain, validated against official ground-truth field data. Clicking a destroyed building reveals high-resolution optical patch evidence, confirming complete obliteration of the roof plane with an AI model confidence of seventy-nine percent."
    },
    {
        "id": "scene06_chamoli_explainable_triage",
        "title": "Act III: Explainable Multi-Factor Priority Triage",
        "text": "Stage Two: Prioritise. Instead of a black box, our explainable multi-factor decision engine evaluates each structure using an objective mathematical formula—weighting forty percent structural severity, twenty-five percent population exposure, twenty percent critical infrastructure proximity, and fifteen percent road accessibility to establish transparent triage rankings."
    },
    {
        "id": "scene07_chamoli_road_hazards",
        "title": "Act III: Active Road Network & Blocked Hazard Detection",
        "text": "Situational awareness extends beyond buildings. The GIS network dynamically flags road hazards, identifying washed-out bridges and impassable riverbanks as blocked corridors to prevent rescue convoys from entering danger zones."
    },
    {
        "id": "scene08_chamoli_response_route",
        "title": "Act III: Hazard-Aware Response Access Routing",
        "text": "Stage Three: Respond. With a single click, our hazard-aware Dijkstra routing engine computes the optimal ingress corridor from the Chamoli Incident Staging Base, calculating distance and traversal time while safely detouring around the flooded road closure directly to the target structure."
    },
    {
        "id": "scene09_chamoli_evacuation_route",
        "title": "Act III: PostGIS Civilian Evacuation Routing",
        "text": "Simultaneously, evacuation routing queries live hospital capacities in PostGIS, instantly plotting the fastest open transit corridor to Joshimath Community Health Centre to guarantee rapid medical transfer for injured civilians."
    },
    {
        "id": "scene10_dashboard_and_architecture",
        "title": "Act IV: Executive Dashboard & Enterprise Microservice Stack",
        "text": "Commanders can monitor overall operational readiness through our Executive Dashboard, featuring real-time damage distributions, triage urgency KPIs, and facility capacity tables—all powered by an enterprise microservice architecture uniting PyTorch, FastAPI, Spring Boot, and PostgreSQL PostGIS."
    },
    {
        "id": "scene11_closing_callout",
        "title": "Act V: Grand Closing Callout - Smart India Hackathon 2026",
        "text": "The AI-Driven Disaster Response Intelligence System: transforming raw satellite pixels and geospatial data into decisive, life-saving operational intelligence. Assess. Prioritise. Respond."
    }
]

def get_audio_duration(filepath):
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [ff, "-i", filepath]
    res = subprocess.run(cmd, stderr=subprocess.PIPE, text=True)
    for line in res.stderr.splitlines():
        if "Duration:" in line:
            parts = line.strip().split(",")[0].split("Duration: ")[1]
            h, m, s = parts.split(":")
            return float(h) * 3600 + float(m) * 60 + float(s)
    return 0.0

async def build_suite(scenes, out_dir, suite_name, rate=RATE):
    os.makedirs(out_dir, exist_ok=True)
    print(f"\n==================== Generating {suite_name} ====================")
    durations = {}
    for scene in scenes:
        fp = os.path.join(out_dir, f"{scene['id']}.mp3")
        c = edge_tts.Communicate(scene['text'], VOICE, rate=rate)
        await c.save(fp)
        dur = get_audio_duration(fp)
        durations[scene['id']] = dur
        print(f"  [{scene['id']}] {dur:.2f}s -- {scene['title']}")
    
    # Silence between scenes (0.45s)
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    silence_file = os.path.join(out_dir, "silence.mp3")
    subprocess.run([
        ff, "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
        "-t", "0.45", "-q:a", "9", "-acodec", "libmp3lame", silence_file
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    concat_list = os.path.join(out_dir, "concat.txt")
    with open(concat_list, "w") as f:
        for i, scene in enumerate(scenes):
            s_fp = os.path.abspath(os.path.join(out_dir, f"{scene['id']}.mp3")).replace("\\", "/")
            f.write(f"file '{s_fp}'\n")
            if i < len(scenes) - 1:
                sil_fp = os.path.abspath(silence_file).replace("\\", "/")
                f.write(f"file '{sil_fp}'\n")
    
    master_fp = os.path.join(out_dir, "master.mp3")
    subprocess.run([
        ff, "-y", "-f", "concat", "-safe", "0", "-i", concat_list,
        "-c", "copy", master_fp
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    total_dur = get_audio_duration(master_fp)
    print(f">> Total {suite_name} Duration: {total_dur:.2f} seconds ({master_fp})")
    
    meta = {
        "suite": suite_name,
        "total_duration": total_dur,
        "scenes": [
            {"id": s["id"], "title": s["title"], "duration": durations[s["id"]], "text": s["text"]}
            for s in scenes
        ]
    }
    with open(os.path.join(out_dir, "metadata.json"), "w") as f:
        json.dump(meta, f, indent=2)
    return total_dur

async def main():
    await build_suite(DUAL_MASTER_SCENES, "outputs/voiceover_dual_master", "Dual Master Demo (~150-170s)")

if __name__ == "__main__":
    asyncio.run(main())
