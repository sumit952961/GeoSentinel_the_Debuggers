import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('../frontend/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const FFMPEG_PATH = 'C:\\Users\\rajat\\AppData\\Roaming\\Python\\Python313\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe';
const CLOSING_HTML_PATH = 'file:///' + path.resolve('scripts/closing_card.html').replace(/\\/g, '/');

// Audio metadata
const metaPath = path.resolve('outputs/voiceover_cinematic/metadata.json');
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const TARGET_TOTAL_DUR = meta.total_duration; // 295.32s

console.log('Loaded Voiceover Metadata:');
console.log(`Voice: ${meta.voice}`);
console.log(`Target Total Duration: ${TARGET_TOTAL_DUR}s`);

// HUD & Cursor Helpers
async function updateHUD(page, phaseText, titleText, detailText, accentColor = '#0284c7') {
  await page.evaluate((phase, title, detail, accent) => {
    let hud = document.getElementById('demo-hud-overlay');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'demo-hud-overlay';
      hud.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 24px;
        z-index: 99999;
        display: flex;
        align-items: center;
        gap: 16px;
        background: rgba(15, 23, 42, 0.94);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(56, 189, 248, 0.35);
        border-left: 4px solid ${accent};
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 12px 36px rgba(0,0,0,0.6);
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        transition: all 0.3s ease;
      `;
      document.body.appendChild(hud);
    }
    hud.style.borderLeftColor = accent;
    hud.innerHTML = `
      <div style="background: rgba(2, 132, 199, 0.2); border: 1px solid ${accent}; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; color: #38bdf8;">
        ${phase}
      </div>
      <div>
        <div style="font-size: 14px; font-weight: 700; color: #f8fafc; letter-spacing: -0.01em;">
          ${title}
        </div>
        <div style="font-size: 11px; color: #94a3b8; font-family: monospace; margin-top: 2px;">
          ${detail}
        </div>
      </div>
    `;
  }, phaseText, titleText, detailText, accentColor);
}

async function initPageEnhancements(page) {
  await page.evaluate(() => {
    // 1. Continuous Heartbeat Animator
    if (!document.getElementById('demo-heartbeat-animator')) {
      const pulse = document.createElement('div');
      pulse.id = 'demo-heartbeat-animator';
      pulse.style.cssText = 'position:fixed;bottom:0;right:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:9999999;';
      document.body.appendChild(pulse);
      let v = 0;
      setInterval(() => {
        pulse.style.opacity = (v = 1 - v) ? '0.01' : '0.02';
      }, 40);
    }

    // 2. Virtual Cursor
    if (!document.getElementById('demo-virtual-cursor')) {
      const c = document.createElement('div');
      c.id = 'demo-virtual-cursor';
      c.style.cssText = `
        position: fixed;
        top: 500px;
        left: 960px;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: rgba(56, 189, 248, 0.35);
        border: 2px solid #38bdf8;
        box-shadow: 0 0 14px rgba(56, 189, 248, 0.8);
        pointer-events: none;
        z-index: 999999;
        transform: translate(-50%, -50%);
        transition: top 0.4s ease-out, left 0.4s ease-out, transform 0.15s ease;
      `;
      const dot = document.createElement('div');
      dot.style.cssText = `
        position: absolute;
        top: 50%; left: 50%;
        width: 4px; height: 4px;
        border-radius: 50%;
        background: #ffffff;
        transform: translate(-50%, -50%);
      `;
      c.appendChild(dot);
      document.body.appendChild(c);
    }
  });
}

async function moveVirtualCursor(page, x, y, click = false) {
  await page.evaluate((tx, ty, doClick) => {
    const c = document.getElementById('demo-virtual-cursor');
    if (!c) return;
    c.style.left = `${tx}px`;
    c.style.top = `${ty}px`;
    if (doClick) {
      setTimeout(() => {
        c.style.transform = 'translate(-50%, -50%) scale(0.7)';
        const ring = document.createElement('div');
        ring.style.cssText = `
          position: fixed;
          left: ${tx}px; top: ${ty}px;
          width: 40px; height: 40px;
          border-radius: 50%;
          border: 2px solid #38bdf8;
          transform: translate(-50%, -50%) scale(0.5);
          opacity: 1;
          pointer-events: none;
          z-index: 999998;
          transition: all 0.4s ease-out;
        `;
        document.body.appendChild(ring);
        setTimeout(() => {
          ring.style.transform = 'translate(-50%, -50%) scale(1.6)';
          ring.style.opacity = '0';
          setTimeout(() => ring.remove(), 400);
        }, 20);
        setTimeout(() => {
          c.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 150);
      }, 400);
    }
  }, x, y, click);
}

async function recordCinematicDemo() {
  console.log('\n========================================================================');
  console.log(`RECORDING CINEMATIC MASTERPIECE DEMO (Target: ${TARGET_TOTAL_DUR}s)`);
  console.log('Featuring 3D Dynamic Movement, Zooms/Unzooms, Triage Math & Routing');
  console.log('========================================================================\n');

  const tempDir = './outputs/temp_cinematic_frames';
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-web-security', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));
  await initPageEnhancements(page);

  const client = await page.target().createCDPSession();
  const frames = [];
  let t0 = null;

  client.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    if (t0 === null) t0 = metadata.timestamp;
    const offset = metadata.timestamp - t0;
    const frameIndex = frames.length;
    const filename = `frame_${String(frameIndex).padStart(5, '0')}.jpg`;
    const filepath = path.join(tempDir, filename);
    fs.writeFileSync(filepath, Buffer.from(data, 'base64'));
    frames.push({ filename, offset, timestamp: metadata.timestamp });

    try {
      await client.send('Page.screencastFrameAck', { sessionId });
    } catch (e) {}
  });

  console.log('Starting screencast recording...');
  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 92,
    maxWidth: 1920,
    maxHeight: 1080,
    everyNthFrame: 1
  });

  const startRecordTime = Date.now();
  const elapsed = () => (Date.now() - startRecordTime) / 1000;
  const waitUntil = async (targetSec) => {
    while (elapsed() < targetSec) {
      await new Promise(r => setTimeout(r, 40));
    }
  };

  // --------------------------------------------------------------------------
  // SCENE 01 (0.00s - 30.52s): Act I: The Hook & Autonomous Pipeline
  // --------------------------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 01: The Hook & Paradigm Shift (0.00s - 30.52s)`);
  await updateHUD(page, 'SYSTEM PARADIGM', 'AI-Driven Disaster Response Intelligence System', 'Autonomous Satellite Damage Assessment, Explainable Triage & Routing', '#0284c7');
  await moveVirtualCursor(page, 960, 420);

  await waitUntil(7.0);
  console.log(`[${elapsed().toFixed(1)}s] Scrolling to 3-step workflow pipeline...`);
  for (let i = 0; i < 22; i++) {
    await page.evaluate(() => window.scrollBy(0, 24));
    await new Promise(r => setTimeout(r, 60));
  }
  await moveVirtualCursor(page, 520, 500);

  await waitUntil(17.0);
  console.log(`[${elapsed().toFixed(1)}s] Scrolling to scenarios grid...`);
  for (let i = 0; i < 18; i++) {
    await page.evaluate(() => window.scrollBy(0, 25));
    await new Promise(r => setTimeout(r, 60));
  }
  await moveVirtualCursor(page, 420, 520, true);

  await waitUntil(30.52);

  // --------------------------------------------------------------------------
  // SCENE 02 (30.52s - 62.70s): Act II: 3D Earth Globe - Topographic Wildfire Flight
  // --------------------------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 02: 3D Earth Globe (Woolsey Wildfire)`);
  await page.goto('http://localhost:5173/scenario/1/map', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));
  await initPageEnhancements(page);

  // Ensure 3D Earth view mode
  await page.evaluate(() => {
    if (window.__DRAS_SET_MAP_VIEW_MODE__) window.__DRAS_SET_MAP_VIEW_MODE__('3D');
  });
  await updateHUD(page, 'ACT II: 3D EARTH GLOBE', 'Topographic Wildfire Assessment (Woolsey Fire)', 'Cesium 3D Engine • True Elevation Terrain • Canyon Slopes & Ridge Lines', '#ef4444');
  await moveVirtualCursor(page, 960, 500);

  await waitUntil(38.0);
  console.log(`[${elapsed().toFixed(1)}s] Flying camera into mountain canyon topography...`);
  await page.evaluate(() => {
    if (window.__DRAS_CESIUM_VIEWER__ && window.Cesium) {
      const viewer = window.__DRAS_CESIUM_VIEWER__;
      const Cesium = window.Cesium;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-118.7245, 34.0720, 520),
        orientation: {
          heading: Cesium.Math.toRadians(25.0),
          pitch: Cesium.Math.toRadians(-32.0),
          roll: 0.0
        },
        duration: 3.5
      });
    }
  });

  await waitUntil(48.0);
  console.log(`[${elapsed().toFixed(1)}s] Orbiting around canyon ridges...`);
  await page.evaluate(() => {
    if (window.__DRAS_CESIUM_VIEWER__ && window.Cesium) {
      const viewer = window.__DRAS_CESIUM_VIEWER__;
      const Cesium = window.Cesium;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-118.7230, 34.0710, 420),
        orientation: {
          heading: Cesium.Math.toRadians(45.0),
          pitch: Cesium.Math.toRadians(-28.0),
          roll: 0.0
        },
        duration: 3.5
      });
    }
  });
  await moveVirtualCursor(page, 820, 460);

  await waitUntil(62.70);

  // --------------------------------------------------------------------------
  // SCENE 03 (62.70s - 110.63s): Act II: Deep Zoom, Dynamic Camera Movement & 3D Extrusions
  // --------------------------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 03: 3D Dynamic Movement, Zooms & Building Rooftops (48s!)`);
  await updateHUD(page, 'ACT II: 3D BUILDINGS', 'Deep Zoom & Dynamic 3D Camera Traversal', '181 Extruded Structures • 4-Tier Heights & Colors (Red: Destroyed, Orange: Major)', '#f97316');

  // Click 'Buildings' button in Left Panel to isolate structures cleanly
  await waitUntil(65.0);
  console.log(`[${elapsed().toFixed(1)}s] Clicking 'Buildings' view mode...`);
  await moveVirtualCursor(page, 50, 225, true);
  await page.evaluate(() => {
    if (window.__DRAS_SET_VIEW_LEVEL__) window.__DRAS_SET_VIEW_LEVEL__('BUILDINGS');
  });

  // 1. Deep fly directly over the 3D building rooftops!
  await waitUntil(68.0);
  console.log(`[${elapsed().toFixed(1)}s] Flying camera down to canyon rooftops (140m altitude)...`);
  await page.evaluate(() => {
    if (window.__DRAS_CESIUM_VIEWER__ && window.Cesium) {
      const viewer = window.__DRAS_CESIUM_VIEWER__;
      const Cesium = window.Cesium;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-118.7242, 34.0728, 140),
        orientation: {
          heading: Cesium.Math.toRadians(38.0),
          pitch: Cesium.Math.toRadians(-22.0),
          roll: 0.0
        },
        duration: 3.0
      });
    }
  });

  // 2. MOVE THE MAP WHILE SHOWING BUILDINGS (Dynamic pan across the neighborhood)
  await waitUntil(74.0);
  console.log(`[${elapsed().toFixed(1)}s] Moving camera across neighborhood structures...`);
  await page.evaluate(() => {
    if (window.__DRAS_CESIUM_VIEWER__ && window.Cesium) {
      const viewer = window.__DRAS_CESIUM_VIEWER__;
      const Cesium = window.Cesium;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-118.7225, 34.0740, 150),
        orientation: {
          heading: Cesium.Math.toRadians(55.0),
          pitch: Cesium.Math.toRadians(-20.0),
          roll: 0.0
        },
        duration: 4.5
      });
    }
  });
  await moveVirtualCursor(page, 520, 520);
  await waitUntil(78.0);
  await moveVirtualCursor(page, 460, 560);

  // 3. UNZOOM SMOOTHLY TO REVEAL THE ENTIRE VALLEY
  await waitUntil(81.0);
  console.log(`[${elapsed().toFixed(1)}s] Unzooming to reveal the entire valley landscape...`);
  await page.evaluate(() => {
    if (window.__DRAS_CESIUM_VIEWER__ && window.Cesium) {
      const viewer = window.__DRAS_CESIUM_VIEWER__;
      const Cesium = window.Cesium;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-118.7250, 34.0710, 580),
        orientation: {
          heading: Cesium.Math.toRadians(25.0),
          pitch: Cesium.Math.toRadians(-38.0),
          roll: 0.0
        },
        duration: 3.5
      });
    }
  });
  await moveVirtualCursor(page, 720, 480);

  // 4. ZOOM BACK IN RIGHT ABOVE THE ROOFTOPS
  await waitUntil(87.0);
  console.log(`[${elapsed().toFixed(1)}s] Zooming back in tightly over destroyed rooftop cluster...`);
  await page.evaluate(() => {
    if (window.__DRAS_CESIUM_VIEWER__ && window.Cesium) {
      const viewer = window.__DRAS_CESIUM_VIEWER__;
      const Cesium = window.Cesium;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-118.7242, 34.0728, 130),
        orientation: {
          heading: Cesium.Math.toRadians(40.0),
          pitch: Cesium.Math.toRadians(-22.0),
          roll: 0.0
        },
        duration: 3.0
      });
    }
  });

  // 5. CLICK FILTER FOR DESTROYED BUILDINGS
  await waitUntil(92.0);
  console.log(`[${elapsed().toFixed(1)}s] Clicking 'Destroyed' severity filter...`);
  await moveVirtualCursor(page, 100, 465, true);
  await page.evaluate(() => {
    if (window.__DRAS_SET_DAMAGE_FILTER__) window.__DRAS_SET_DAMAGE_FILTER__('destroyed');
  });

  // 6. CLICK 'ALL CLASSES' TO RESTORE ALL BUILDINGS
  await waitUntil(96.0);
  console.log(`[${elapsed().toFixed(1)}s] Clicking 'All Classes' filter to bring back all buildings...`);
  await moveVirtualCursor(page, 50, 420, true);
  await page.evaluate(() => {
    if (window.__DRAS_SET_DAMAGE_FILTER__) window.__DRAS_SET_DAMAGE_FILTER__('ALL');
  });

  // 7. SELECT DESTROYED STRUCTURE TO OPEN INSPECTOR
  await waitUntil(100.0);
  console.log(`[${elapsed().toFixed(1)}s] Selecting 3D Structure #185...`);
  await moveVirtualCursor(page, 510, 530, true);
  await page.evaluate(() => {
    if (window.__DRAS_SELECT_BUILDING__) window.__DRAS_SELECT_BUILDING__('destroyed');
  });

  await waitUntil(104.0);
  console.log(`[${elapsed().toFixed(1)}s] Highlighting satellite evidence card on right...`);
  await moveVirtualCursor(page, 1720, 260); // AI Satellite Evidence
  await waitUntil(108.0);
  await moveVirtualCursor(page, 1720, 620); // Priority breakdown

  await waitUntil(111.03);

  // --------------------------------------------------------------------------
  // SCENE 04 (111.03s - 130.78s): Act III: 2D GIS Operations - Chamoli Flash Flood
  // --------------------------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 04: Transitioning to 2D Operations Map (Chamoli)`);
  await page.goto('http://localhost:5173/scenario/2/map', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1800));
  await initPageEnhancements(page);

  // Switch to 2D View
  await page.evaluate(() => {
    if (window.__DRAS_SET_MAP_VIEW_MODE__) window.__DRAS_SET_MAP_VIEW_MODE__('2D');
  });
  await new Promise(r => setTimeout(r, 1000));

  await page.evaluate(() => {
    if (window.__DRAS_MAP__) window.__DRAS_MAP__.setView([30.4400, 79.6200], 14, { animate: false });
  });

  await updateHUD(page, 'ACT III: 2D GIS OPERATIONS', 'Himalayan Flash Flood (Chamoli 2021)', 'Uttarakhand, India • Rishiganga & Dhauliganga Valleys • Avalanche Surge', '#0284c7');
  await moveVirtualCursor(page, 850, 480);

  await waitUntil(120.0);
  console.log(`[${elapsed().toFixed(1)}s] Panning along Himalayan flood surge path...`);
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => {
      if (window.__DRAS_MAP__) window.__DRAS_MAP__.panBy([3, -2], { animate: false });
    });
    await new Promise(r => setTimeout(r, 100));
  }

  await waitUntil(131.18);

  // --------------------------------------------------------------------------
  // SCENE 05 (131.18s - 157.24s): Act III: Deep Zoom into Riverbed Structures
  // --------------------------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 05: Deep Zooming into Chamoli Riverbed Structures`);
  await page.evaluate(() => {
    if (window.__DRAS_MAP__) window.__DRAS_MAP__.setView([30.4404, 79.6197], 17, { animate: true });
  });
  await updateHUD(page, 'ACT III: DEEP ZOOM', 'Riverbed Structures & Official Ground Truth', 'EIDC Westoby Field-Surveyed Ground Truth • 45 Verified Footprints', '#10b981');
  await new Promise(r => setTimeout(r, 1200));

  await waitUntil(136.0);
  console.log(`[${elapsed().toFixed(1)}s] Hovering over riverbed building footprints...`);
  await moveVirtualCursor(page, 720, 520);
  await waitUntil(140.0);
  await moveVirtualCursor(page, 860, 420);

  await waitUntil(143.0);
  console.log(`[${elapsed().toFixed(1)}s] Selecting Structure #624...`);
  await moveVirtualCursor(page, 860, 420, true);
  await page.evaluate(() => {
    if (window.__DRAS_SELECT_BUILDING__) window.__DRAS_SELECT_BUILDING__('destroyed');
  });

  await waitUntil(148.0);
  console.log(`[${elapsed().toFixed(1)}s] Highlighting EIDC Ground Truth badge & optical patch...`);
  await moveVirtualCursor(page, 1720, 220); // Ground truth badge
  await waitUntil(152.0);
  await moveVirtualCursor(page, 1720, 290); // Optical sensor pre/post

  await waitUntil(157.64);

  // --------------------------------------------------------------------------
  // SCENE 06 (157.64s - 188.82s): Act III: Explainable Multi-Factor Priority Triage
  // --------------------------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 06: Explainable Multi-Factor Priority Triage`);
  await updateHUD(page, 'STAGE 02: PRIORITISE', 'Explainable Multi-Factor Triage Scoring', 'Score: 0.40·Severity + 0.25·Population + 0.20·Infrastructure + 0.15·Access', '#f59e0b');

  await moveVirtualCursor(page, 1720, 580); // High Priority score header
  await waitUntil(164.0);
  console.log(`[${elapsed().toFixed(1)}s] Highlighting Structural Severity (40%)...`);
  await moveVirtualCursor(page, 1720, 610);
  await waitUntil(170.0);
  console.log(`[${elapsed().toFixed(1)}s] Highlighting Population Exposure (20%)...`);
  await moveVirtualCursor(page, 1720, 625);
  await waitUntil(176.0);
  console.log(`[${elapsed().toFixed(1)}s] Highlighting Critical Infrastructure (15%)...`);
  await moveVirtualCursor(page, 1720, 642);
  await waitUntil(182.0);
  console.log(`[${elapsed().toFixed(1)}s] Highlighting Road Accessibility (15%)...`);
  await moveVirtualCursor(page, 1720, 660);

  await waitUntil(189.22);

  // --------------------------------------------------------------------------
  // SCENE 07 (189.22s - 209.67s): Act III: Active Road Network & Blocked Hazards
  // --------------------------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 07: Active Road Network & Blocked Hazard Detection`);
  await page.evaluate(() => {
    if (window.__DRAS_MAP__) window.__DRAS_MAP__.setView([30.4550, 79.6200], 14, { animate: true });
  });
  await updateHUD(page, 'SITUATIONAL AWARENESS', 'Active Road Network & Blocked Hazard Detection', 'Washed-Out Riverbank Road Identified as Blocked Corridor (Violet Dashed)', '#a855f7');

  await waitUntil(195.0);
  console.log(`[${elapsed().toFixed(1)}s] Highlighting blocked river corridor...`);
  await moveVirtualCursor(page, 1080, 360);
  await waitUntil(202.0);
  await moveVirtualCursor(page, 1140, 480, true);

  await waitUntil(210.07);

  // --------------------------------------------------------------------------
  // SCENE 08 (210.07s - 232.17s): Act III: Hazard-Aware Dijkstra Response Access Routing
  // --------------------------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 08: Calculating Response Access Route (Dijkstra)`);
  await moveVirtualCursor(page, 1720, 840, true);
  await new Promise(r => setTimeout(r, 400));

  await page.evaluate(() => {
    if (window.__DRAS_CALCULATE_ROUTE__) window.__DRAS_CALCULATE_ROUTE__('RESPONSE');
  });
  await updateHUD(page, 'STAGE 03: RESPOND', 'Hazard-Aware Dijkstra Response Access Routing', 'Chamoli District HQ (Gopeshwar) → Structure #624 (Detours Blocked Road)', '#ea580c');

  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => {
    if (window.__DRAS_MAP__) window.__DRAS_MAP__.setView([30.4480, 79.6100], 13, { animate: true });
  });

  await waitUntil(218.0);
  console.log(`[${elapsed().toFixed(1)}s] Tracing response route from Staging Base...`);
  await moveVirtualCursor(page, 520, 680); // Staging Base marker
  await waitUntil(224.0);
  await moveVirtualCursor(page, 950, 440); // Mountain detour pass
  await waitUntil(228.0);
  await moveVirtualCursor(page, 1100, 565); // Destination Structure #624

  await waitUntil(232.57);

  // --------------------------------------------------------------------------
  // SCENE 09 (232.57s - 251.51s): Act III: PostGIS Civilian Evacuation Routing
  // --------------------------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 09: Calculating Evacuation Route to CHC Joshimath`);
  await moveVirtualCursor(page, 1720, 875, true);
  await new Promise(r => setTimeout(r, 400));

  await page.evaluate(() => {
    if (window.__DRAS_CALCULATE_ROUTE__) window.__DRAS_CALCULATE_ROUTE__('EVACUATION', 'hospital');
  });
  await updateHUD(page, 'STAGE 03: RESPOND', 'PostGIS Civilian Evacuation Routing', 'Target Structure #624 → CHC Joshimath (Nearest Operational Hospital)', '#06b6d4');

  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => {
    if (window.__DRAS_MAP__) window.__DRAS_MAP__.setView([30.4900, 79.6000], 12, { animate: true });
  });

  await waitUntil(240.0);
  console.log(`[${elapsed().toFixed(1)}s] Highlighting CHC Joshimath destination...`);
  await moveVirtualCursor(page, 880, 220); // CHC Joshimath pin

  await waitUntil(251.91);

  // --------------------------------------------------------------------------
  // SCENE 10 (251.91s - 277.01s): Act IV: Executive Analytics & Microservice Stack
  // --------------------------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 10: Executive Situation Dashboard & Architecture`);
  await page.goto('http://localhost:5173/scenario/2/dashboard', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1200));
  await initPageEnhancements(page);
  await updateHUD(page, 'ACT IV: DASHBOARD', 'Executive Situation Summary & KPIs', 'Real-Time Damage Distributions • Triage Urgency • Hospital Capacities', '#3b82f6');
  await moveVirtualCursor(page, 480, 240);

  await waitUntil(258.0);
  console.log(`[${elapsed().toFixed(1)}s] Sweeping damage & priority breakdown charts...`);
  await moveVirtualCursor(page, 550, 480);
  await waitUntil(263.0);
  await moveVirtualCursor(page, 1200, 480);

  await waitUntil(266.0);
  console.log(`[${elapsed().toFixed(1)}s] Transitioning to System Infrastructure Diagnostics...`);
  await page.goto('http://localhost:5173/system', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1200));
  await initPageEnhancements(page);
  await updateHUD(page, 'ACT IV: ARCHITECTURE', 'Enterprise Microservice Stack', 'PyTorch • FastAPI • Spring Boot 3.4 • PostgreSQL 17 / PostGIS 3.5 • React 19', '#10b981');
  await moveVirtualCursor(page, 520, 360);

  await waitUntil(272.0);
  await moveVirtualCursor(page, 960, 440);

  await waitUntil(277.41);

  // --------------------------------------------------------------------------
  // SCENE 11 (277.41s - 295.32s): Act V: Grand Closing Callout - SIH 2026
  // --------------------------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 11: Grand Closing Callout (Smart India Hackathon 2026)`);
  await page.goto(CLOSING_HTML_PATH, { waitUntil: 'domcontentloaded' });
  await initPageEnhancements(page);

  while (elapsed() < TARGET_TOTAL_DUR) {
    const curTime = elapsed();
    const cursorX = 960 + Math.sin(curTime * 1.5) * 120;
    const cursorY = 560 + Math.cos(curTime * 1.5) * 35;
    await moveVirtualCursor(page, cursorX, cursorY);
    await new Promise(r => setTimeout(r, 60));
  }

  console.log(`[${elapsed().toFixed(1)}s] Stopping screencast recording...`);
  await client.send('Page.stopScreencast');
  await browser.close();

  console.log(`\nCaptured ${frames.length} total frames for Cinematic Master Demo.`);

  // Build ffconcat file
  const concatFile = path.join(tempDir, 'frames.txt');
  let concatContent = 'ffconcat version 1.0\n';
  let accumDur = 0.0;
  for (let i = 0; i < frames.length; i++) {
    const cur = frames[i];
    let dur = 0.04;
    if (i < frames.length - 1) {
      dur = frames[i + 1].offset - cur.offset;
      if (dur <= 0 || isNaN(dur)) dur = 0.04;
    } else {
      dur = Math.max(0.2, TARGET_TOTAL_DUR - cur.offset);
    }
    accumDur += dur;
    concatContent += `file ${cur.filename}\nduration ${dur.toFixed(4)}\n`;
  }
  concatContent += `file ${frames[frames.length - 1].filename}\n`;
  fs.writeFileSync(concatFile, concatContent);
  console.log(`Frames sequence duration: ${accumDur.toFixed(2)}s (Target: ${TARGET_TOTAL_DUR}s)`);

  // Encode with FFmpeg
  const audioFile = path.resolve('outputs/voiceover_cinematic/master.mp3').replace(/\\/g, '/');
  const outFile = path.resolve('outputs/videos/AIDRS_SIH_Cinematic_Master_1080p.mp4').replace(/\\/g, '/');
  
  console.log('Encoding AIDRS_SIH_Cinematic_Master_1080p.mp4 with FFmpeg...');
  const encodeCmd = `"${FFMPEG_PATH}" -y -f concat -safe 0 -i "${concatFile}" -i "${audioFile}" -c:v libx264 -pix_fmt yuv420p -r 25 -c:a aac -b:a 192k -t ${TARGET_TOTAL_DUR} "${outFile}"`;
  execSync(encodeCmd, { stdio: 'inherit' });

  const stats = fs.statSync(outFile);
  console.log(`\n========================================================================`);
  console.log(`>>> CINEMATIC MASTERPIECE VIDEO CREATED SUCCESSFULLY: ${outFile}`);
  console.log(`>>> Video Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`>>> Total Run Time: ${TARGET_TOTAL_DUR}s`);
  console.log(`========================================================================\n`);
  return outFile;
}

recordCinematicDemo().catch(console.error);
