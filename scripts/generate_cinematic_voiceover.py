import asyncio
import os
import subprocess
import json
import imageio_ffmpeg
import edge_tts

VOICE = "en-US-AndrewMultilingualNeural"
RATE = "+3%"

CINEMATIC_SCENES = [
    {
        "id": "cine01_hook_overview",
        "title": "Act I: The Hook & Autonomous Pipeline",
        "text": "When catastrophic disaster strikes, every single second determines human survival. Traditional damage assessment takes days of hazardous manual surveys. But what you are looking at right now is a revolutionary paradigm shift: our AI-Driven Disaster Response Intelligence System. An autonomous, enterprise-grade command platform that instantly ingests raw satellite imagery and executes a seamless three-stage mission: Assess, Prioritise, and Respond."
    },
    {
        "id": "cine02_wildfire_3d_globe",
        "title": "Act II: 3D Earth Globe - Topographic Wildfire Flight",
        "text": "Let's enter our full three-dimensional Cesium Earth engine, analyzing the devastating Woolsey Wildfire across California's rugged terrain. Look at this planetary descent—we seamlessly fuse high-resolution orbital satellite feeds with true 3D elevation terrain. Notice how commanders can inspect steep canyon walls, assess windward ridge lines, and visualize operational response sectors directly over the natural topography. This isn't a flat map; it's a living, breathing tactical operating picture."
    },
    {
        "id": "cine03_wildfire_3d_buildings_movement",
        "title": "Act II: Deep Zoom, Dynamic Camera Movement & 3D Building Extrusions",
        "text": "Now, let's fly deep down into the mountain canyon. Watch what happens: our AI automatically localizes every single building footprint, extrudes it in true 3D, and classifies the structural damage into four standardized severity tiers. Crimson structures are completely destroyed, amber represents major damage, and emerald marks intact homes. Let's zoom out to see the entire valley... and zoom back in right above the rooftops. Watch as we filter specifically for destroyed structures—and bring back the entire neighborhood with a single click. When we select a structure, our AI evidence inspector slides open, revealing side-by-side pre- and post-disaster optical comparisons and exact damage probabilities."
    },
    {
        "id": "cine04_chamoli_2d_transition",
        "title": "Act III: 2D GIS Operations Map - Himalayan Flash Flood",
        "text": "For mission-critical tactical precision, commanders can transition instantly to our 2D GIS Operations Map. Here, we're deploying to the high Himalayas in Uttarakhand, India, assessing the catastrophic Chamoli Flash Flood triggered by an ice and rock avalanche through the Rishiganga and Dhauliganga valleys."
    },
    {
        "id": "cine05_chamoli_deep_zoom_ground_truth",
        "title": "Act III: Deep Zoom into Riverbed Structures & Ground Truth",
        "text": "Look at this deep zoom straight down into the Himalayan riverbed. Our platform isolates every vulnerable structure along the flood plain, rigorously validated against official EIDC ground-truth field data. Selecting Structure 624 instantly pulls up the satellite evidence card—proving complete structural collapse of the roof plane with an undeniable seventy-nine percent model confidence."
    },
    {
        "id": "cine06_chamoli_explainable_triage",
        "title": "Act III: The Game Changer - Explainable Multi-Factor Priority Triage",
        "text": "Now, here is what truly separates our system from any other: Stage Two, Prioritise. In an emergency, first responders cannot rely on a black-box AI. Our platform implements an explainable multi-factor mathematical formula—weighting forty percent structural severity, twenty-five percent population exposure, twenty percent critical infrastructure proximity, and fifteen percent road accessibility. Every triage decision is completely transparent, objective, and auditable."
    },
    {
        "id": "cine07_chamoli_road_hazards",
        "title": "Act III: Situational Awareness & Active Road Blockage Detection",
        "text": "Total situational awareness requires understanding the roads. Watch as our GIS network analyzes active transport corridors. The system automatically identifies that the main road along the washed-out riverbank is completely obstructed, flagging it as a hazardous blocked corridor to keep emergency convoys out of mortal danger."
    },
    {
        "id": "cine08_chamoli_response_route",
        "title": "Act III: Stage Three: Respond - Hazard-Aware Dijkstra Access Routing",
        "text": "Stage Three: Respond. Watch this live calculation. With one click, our hazard-aware Dijkstra routing engine computes the optimal ingress path from the Chamoli Incident Command Staging Base. It automatically recognizes the blocked flood corridor, calculates an alternative mountain detour, and plots the fastest safe route directly to our target building."
    },
    {
        "id": "cine09_chamoli_evacuation_route",
        "title": "Act III: PostGIS Civilian Evacuation Routing",
        "text": "At the exact same time, we need to evacuate injured civilians. One click initiates an intelligent spatial query across our PostGIS database, finding the nearest operational medical center with open bed capacity—and instantly charting the optimal evacuation corridor north to Joshimath Community Health Centre."
    },
    {
        "id": "cine10_dashboard_and_architecture",
        "title": "Act IV: Executive Analytics & Enterprise Microservice Stack",
        "text": "Commanders maintain full operational oversight through our Executive Dashboard, monitoring real-time damage distributions, triage urgency ratios, and hospital bed availability. Beneath the surface lies an enterprise-grade microservice architecture—uniting PyTorch deep learning, FastAPI, Spring Boot 3.4, and PostgreSQL PostGIS with sub-millisecond spatial indexing."
    },
    {
        "id": "cine11_closing_callout",
        "title": "Act V: Grand Closing Callout - Smart India Hackathon 2026",
        "text": "From American wildfires to Himalayan flash floods, the AI-Driven Disaster Response Intelligence System turns raw satellite pixels into life-saving, decisive action. Autonomous. Explainable. Field-ready. Assess. Prioritise. Respond."
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
    
    # Silence between scenes (0.40s)
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    silence_file = os.path.join(out_dir, "silence.mp3")
    subprocess.run([
        ff, "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
        "-t", "0.40", "-q:a", "9", "-acodec", "libmp3lame", silence_file
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
        "voice": VOICE,
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
    await build_suite(CINEMATIC_SCENES, "outputs/voiceover_cinematic", "Cinematic Master Keynote (~210-230s)")

if __name__ == "__main__":
    asyncio.run(main())
