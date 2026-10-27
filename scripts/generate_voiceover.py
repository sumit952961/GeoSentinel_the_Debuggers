import asyncio
import os
import subprocess
import imageio_ffmpeg
import edge_tts

VOICE = "en-US-ChristopherNeural"

FULL_SCENES = [
    {
        "id": "full_scene1",
        "title": "Scene 1: Hook & Incident Overview",
        "text": "In major disasters, rapid intelligence saves lives. This is the AI-Driven Disaster Response System—a unified platform to assess damage, prioritise response, and coordinate relief in real time."
    },
    {
        "id": "full_scene2",
        "title": "Scene 2: ASSESS - AI Damage Classification",
        "text": "Stage One: Assess. Ingesting pre- and post-disaster satellite imagery, dual-stage computer vision models automatically detect building footprints and classify damage across four severity tiers."
    },
    {
        "id": "full_scene3",
        "title": "Scene 3: PRIORITISE - Explainable Triage",
        "text": "Stage Two: Prioritise. Our explainable multi-factor engine scores every structure—weighting structural damage, population density, infrastructure proximity, and accessibility into an objective triage rank."
    },
    {
        "id": "full_scene4",
        "title": "Scene 4: Road Hazard Analysis",
        "text": "Situational awareness is vital. The GIS engine integrates active road networks, automatically identifying hazardous and blocked corridors to safeguard rescue convoys."
    },
    {
        "id": "full_scene5",
        "title": "Scene 5: RESPOND - Access Routing",
        "text": "Stage Three: Respond. With one click, the system computes hazard-aware routing from the Incident Command Post, detouring safely around blockages directly to critical structures."
    },
    {
        "id": "full_scene6",
        "title": "Scene 6: RESPOND - Evacuation Routing",
        "text": "Simultaneously, evacuation routes query live hospital capacities in PostGIS, plotting the fastest open path to operational medical centers like Malibu Urgent Care."
    },
    {
        "id": "full_scene7",
        "title": "Scene 7: Multi-Scenario Generalisation",
        "text": "Engineered with PyTorch, FastAPI, Spring Boot, and PostGIS, our system generalizes across diverse events, from wildfires to Himalayan flash floods and landslides."
    },
    {
        "id": "full_scene8",
        "title": "Scene 8: Closing Callout",
        "text": "The AI-Driven Disaster Response System: turning raw satellite pixels into life-saving operational intelligence. Assess. Prioritise. Respond."
    }
]

SHORT_SCENES = [
    {
        "id": "short_scene1",
        "title": "Short Scene 1: Hook & Overview",
        "text": "Welcome to the AI-Driven Disaster Response System—an emergency intelligence platform engineered to assess, prioritise, and navigate disaster relief."
    },
    {
        "id": "short_scene2",
        "title": "Short Scene 2: ASSESS",
        "text": "Stage One: Assess. Satellite imagery feeds our dual-stage vision model, instantly mapping buildings and classifying damage across four standardized tiers."
    },
    {
        "id": "short_scene3",
        "title": "Short Scene 3: PRIORITISE",
        "text": "Stage Two: Prioritise. An explainable multi-factor formula weights damage severity, population, and infrastructure into transparent triage scores."
    },
    {
        "id": "short_scene4",
        "title": "Short Scene 4: RESPOND Access",
        "text": "Stage Three: Respond. Integrated GIS detects road blockages, calculating hazard-avoiding corridors from command staging directly to priority sites."
    },
    {
        "id": "short_scene5",
        "title": "Short Scene 5: Evacuation Routing",
        "text": "Live facility querying then maps rapid civilian evacuation routes to nearest operational hospitals and shelters."
    },
    {
        "id": "short_scene6",
        "title": "Short Scene 6: Generalisation & Closing",
        "text": "Generalizing from wildfires to Himalayan landslides, our platform turns satellite imagery into actionable decision support. Assess. Prioritise. Respond."
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

async def build_suite(scenes, out_dir, suite_name, rate="+4%"):
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
    
    # Silence between scenes
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    silence_file = os.path.join(out_dir, "silence.mp3")
    subprocess.run([
        ff, "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
        "-t", "0.5", "-q:a", "9", "-acodec", "libmp3lame", silence_file
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
    
    # Save metadata json
    import json
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
    await build_suite(FULL_SCENES, "outputs/voiceover_full", "Full Demo (75-85s)", rate="+4%")
    await build_suite(SHORT_SCENES, "outputs/voiceover_60s", "Short Demo (~60s)", rate="+5%")

if __name__ == "__main__":
    asyncio.run(main())
