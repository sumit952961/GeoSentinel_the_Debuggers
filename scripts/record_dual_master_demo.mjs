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
const metaPath = path.resolve('outputs/voiceover_dual_master/metadata.json');
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const TARGET_TOTAL_DUR = meta.total_duration; // 213.29s

console.log('Loaded Voiceover Metadata:');
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

async function recordDualMasterDemo() {
  console.log('\n========================================================================');
  console.log(`RECORDING DUAL-SCENARIO MASTER DEMO (Target: ${TARGET_TOTAL_DUR}s)`);
  console.log('Showcasing 3D Wildfire (Cesium) + 2D Chamoli Flood (Leaflet)');
  console.log('========================================================================\n');

  const tempDir = './outputs/temp_dual_master_frames';
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
  // SCENE 01 (0.00s - 20.88s): Act I: Platform Overview & Autonomous Pipeline
  // --------------------------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 01: Platform Overview (0.00s - 20.88s)`);
  await updateHUD(page, 'SYSTEM OVERVIEW', 'AI-Driven Disaster Response Intelligence System', 'ASSESS → PRIORITISE → RESPOND Autonomous Pipeline', '#0284c7');
  await moveVirtualCursor(page, 960, 420);

  await waitUntil(5.0);
  console.log(`[${elapsed().toFixed(1)}s] Scrolling to 3-step pipeline...`);
  for (let i = 0; i < 22; i++) {
    await page.evaluate(() => window.scrollBy(0, 24));
    await new Promise(r => setTimeout(r, 60));
  }
  await moveVirtualCursor(page, 520, 500);

  await waitUntil(12.0);
  console.log(`[${elapsed().toFixed(1)}s] Scrolling to scenarios grid...`);
  for (let i = 0; i < 18; i++) {
    await page.evaluate(() => window.scrollBy(0, 25));
    await new Promise(r => setTimeout(r, 60));
  }
  await moveVirtualCursor(page, 420, 520, true);

  await waitUntil(21.33);

  // --------------------------------------------------------------------------
  // SCENE 02 (21.33s - 42.62s): Act II: 3D Earth Globe - Topographic Wildfire
  // --------------------------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 02: Loading 3D Earth Cesium Globe (Wildfire)`);
  await page.goto('http://localhost:5173/scenario/1/map', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));
  await initPageEnhancements(page);

  // Ensure 3D Earth view mode
  await page.evaluate(() => {
    if (window.__DRAS_SET_MAP_VIEW_MODE__) window.__DRAS_SET_MAP_VIEW_MODE__('3D');
  });
  await updateHUD(page, 'ACT II: 3D EARTH GLOBE', 'Topographic Wildfire Assessment (Woolsey Fire)', 'Cesium 3D Engine • Elevation Terrain Models • Canyon Slopes', '#ef4444');
  await moveVirtualCursor(page, 960, 500);

  await waitUntil(27.0);
  console.log(`[${elapsed().toFixed(1)}s] Flying camera into mountain canyon topography...`);
  await page.evaluate(() => {
    if (window.__DRAS_CESIUM_VIEWER__ && window.Cesium) {
      const viewer = window.__DRAS_CESIUM_VIEWER__;
      const Cesium = window.Cesium;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-118.7245, 34.0720, 480),
        orientation: {
          heading: Cesium.Math.toRadians(25.0),
          pitch: Cesium.Math.toRadians(-30.0),
          roll: 0.0
        },
        duration: 3.0
      });
    }
  });

  await waitUntil(33.0);
  await moveVirtualCursor(page, 780, 450);
  console.log(`[${elapsed().toFixed(1)}s] Highlighting canyon terrain slope...`);
  for (let i = 0; i < 25; i++) {
    const curTime = elapsed();
    const cx = 780 + Math.sin(curTime * 2) * 60;
    const cy = 450 + Math.cos(curTime * 2) * 25;
    await moveVirtualCursor(page, cx, cy);
    await new Promise(r => setTimeout(r, 80));
  }

  await waitUntil(43.07);

  // --------------------------------------------------------------------------
  // SCENE 03 (43.07s - 69.30s): Act II: Deep Zoom on 3D Building Extrusions
  // --------------------------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 03: Deep Zooming into 3D Extruded Buildings`);
  await updateHUD(page, 'ACT II: 3D BUILDINGS', 'Deep Zoom on 3D Building Extrusions', '181 Structures • 4-Tier Damage Heights & Colors (Red: Destroyed, Orange: Major)', '#f97316');

  // Toggle Spatial View to BUILDINGS to clear zone polygons
  await page.evaluate(() => {
    if (window.__DRAS_SET_VIEW_LEVEL__) window.__DRAS_SET_VIEW_LEVEL__('BUILDINGS');
  });
  await new Promise(r => setTimeout(r, 600));

  // Deep fly directly over the 3D building rooftops!
  await page.evaluate(() => {
    if (window.__DRAS_CESIUM_VIEWER__ && window.Cesium) {
      const viewer = window.__DRAS_CESIUM_VIEWER__;
      const Cesium = window.Cesium;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-118.7242, 34.0728, 140),
        orientation: {
          heading: Cesium.Math.toRadians(40.0),
          pitch: Cesium.Math.toRadians(-24.0),
          roll: 0.0
        },
        duration: 2.2
      });
    }
  });
  await new Promise(r => setTimeout(r, 2200));

  await waitUntil(49.0);
  console.log(`[${elapsed().toFixed(1)}s] Moving cursor over 3D building cluster...`);
  await moveVirtualCursor(page, 520, 520);
  await waitUntil(53.0);
  await moveVirtualCursor(page, 480, 560);

  await waitUntil(56.0);
  console.log(`[${elapsed().toFixed(1)}s] Selecting 3D Destroyed Structure...`);
  await moveVirtualCursor(page, 500, 540, true);
  await page.evaluate(() => {
    if (window.__DRAS_SELECT_BUILDING__) window.__DRAS_SELECT_BUILDING__('destroyed');
  });

  await waitUntil(60.0);
  console.log(`[${elapsed().toFixed(1)}s] Highlighting satellite evidence card on right...`);
  await moveVirtualCursor(page, 1720, 260); // AI Satellite Evidence
  await waitUntil(65.0);
  await moveVirtualCursor(page, 1720, 620); // Priority breakdown

  await waitUntil(69.75);

  // --------------------------------------------------------------------------
  // SCENE 04 (69.75s - 88.18s): Act III: 2D GIS Operations - Chamoli Flash Flood
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

  await waitUntil(78.0);
  console.log(`[${elapsed().toFixed(1)}s] Panning along Himalayan flood surge path...`);
  for (let i = 0; i < 28; i++) {
    await page.evaluate(() => {
      if (window.__DRAS_MAP__) window.__DRAS_MAP__.panBy([3, -2], { animate: false });
    });
    await new Promise(r => setTimeout(r, 100));
  }

  await waitUntil(88.63);

  // --------------------------------------------------------------------------
  // SCENE 05 (88.63s - 107.97s): Act III: Deep Zoom on Riverbed Structures
  // --------------------------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 05: Deep Zooming into Chamoli Riverbed Structures`);
  await page.evaluate(() => {
    if (window.__DRAS_MAP__) window.__DRAS_MAP__.setView([30.4404, 79.6197], 17, { animate: true });
  });
  await updateHUD(page, 'ACT III: DEEP ZOOM', 'Riverbed Structures & Ground-Truth Field Data', 'EIDC Westoby Field-Surveyed Ground Truth • 45 Verified Footprints', '#10b981');
  await new Promise(r => setTimeout(r, 1200));

  await waitUntil(93.0);
  console.log(`[${elapsed().toFixed(1)}s] Hovering over riverbed building footprints...`);
  await moveVirtualCursor(page, 720, 520);
  await waitUntil(96.0);
  await moveVirtualCursor(page, 860, 420);

  await waitUntil(98.0);
  console.log(`[${elapsed().toFixed(1)}s] Selecting Structure #624...`);
  await moveVirtualCursor(page, 860, 420, true);
  await page.evaluate(() => {
    if (window.__DRAS_SELECT_BUILDING__) window.__DRAS_SELECT_BUILDING__('destroyed');
  });

  await waitUntil(102.0);
  console.log(`[${elapsed().toFixed(1)}s] Highlighting EIDC Ground Truth badge & optical patch...`);
  await moveVirtualCursor(page, 1720, 220); // Ground truth badge
  await waitUntil(105.0);
  await moveVirtualCursor(page, 1720, 290); // Optical sensor pre/post

  await waitUntil(108.42);

  // --------------------------------------------------------------------------
  // SCENE 06 (108.42s - 130.98s): Act III: Explainable Multi-Factor Priority Triage
  // --------------------------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 06: Explainable Multi-Factor Priority Triage`);
  await updateHUD(page, 'STAGE 02: PRIORITISE', 'Explainable Multi-Factor Triage Scoring', 'Score: 0.40·Severity + 0.25·Population + 0.20·Infrastructure + 0.15·Access', '#f59e0b');

  await moveVirtualCursor(page, 1720, 580); // High Priority score header
  await waitUntil(114.0);
  console.log(`[${elapsed().toFixed(1)}s] Highlighting Structural Severity (40%)...`);
  await moveVirtualCursor(page, 1720, 610);
  await waitUntil(118.0);
  console.log(`[${elapsed().toFixed(1)}s] Highlighting Population Exposure (20%)...`);
  await moveVirtualCursor(page, 1720, 625);
  await waitUntil(122.0);
  console.log(`[${elapsed().toFixed(1)}s] Highlighting Critical Infrastructure (15%)...`);
  await moveVirtualCursor(page, 1720, 642);
  await waitUntil(126.0);
  console.log(`[${elapsed().toFixed(1)}s] Highlighting Road Accessibility (15%)...`);
  await moveVirtualCursor(page, 1720, 660);

  await waitUntil(131.43);

  // --------------------------------------------------------------------------
  // SCENE 07 (131.43s - 146.05s): Act III: Active Road Network & Blocked Hazards
  // --------------------------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 07: Active Road Network & Blocked Hazard Detection`);
  await page.evaluate(() => {
    if (window.__DRAS_MAP__) window.__DRAS_MAP__.setView([30.4550, 79.6200], 14, { animate: true });
  });
  await updateHUD(page, 'SITUATIONAL AWARENESS', 'Active Road Network & Blocked Hazard Detection', 'Washed-Out Riverbank Road Identified as Blocked Corridor (Violet Dashed)', '#a855f7');

  await waitUntil(136.0);
  console.log(`[${elapsed().toFixed(1)}s] Highlighting blocked river corridor...`);
  await moveVirtualCursor(page, 1080, 360);
  await waitUntil(141.0);
  await moveVirtualCursor(page, 1140, 480);

  await waitUntil(146.50);

  // --------------------------------------------------------------------------
  // SCENE 08 (146.50s - 163.52s): Act III: Hazard-Aware Response Access Routing
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

  await waitUntil(152.0);
  console.log(`[${elapsed().toFixed(1)}s] Tracing response route from Staging Base...`);
  await moveVirtualCursor(page, 520, 680); // Staging Base marker
  await waitUntil(157.0);
  await moveVirtualCursor(page, 950, 440); // Mountain detour pass
  await waitUntil(160.0);
  await moveVirtualCursor(page, 1100, 565); // Destination Structure #624

  await waitUntil(163.97);

  // --------------------------------------------------------------------------
  // SCENE 09 (163.97s - 177.51s): Act III: PostGIS Civilian Evacuation Routing
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

  await waitUntil(169.0);
  console.log(`[${elapsed().toFixed(1)}s] Highlighting CHC Joshimath destination...`);
  await moveVirtualCursor(page, 880, 220); // CHC Joshimath pin

  await waitUntil(177.96);

  // --------------------------------------------------------------------------
  // SCENE 10 (177.96s - 197.57s): Act IV: Executive Dashboard & Microservice Stack
  // --------------------------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 10: Executive Situation Dashboard & Architecture`);
  await page.goto('http://localhost:5173/scenario/2/dashboard', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1200));
  await initPageEnhancements(page);
  await updateHUD(page, 'ACT IV: DASHBOARD', 'Executive Situation Summary & KPIs', 'Real-Time Damage Distributions • Triage Urgency • Hospital Capacities', '#3b82f6');
  await moveVirtualCursor(page, 480, 240);

  await waitUntil(183.0);
  console.log(`[${elapsed().toFixed(1)}s] Sweeping damage & priority breakdown charts...`);
  await moveVirtualCursor(page, 550, 480);
  await waitUntil(186.0);
  await moveVirtualCursor(page, 1200, 480);

  await waitUntil(188.0);
  console.log(`[${elapsed().toFixed(1)}s] Transitioning to System Infrastructure Diagnostics...`);
  await page.goto('http://localhost:5173/system', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1200));
  await initPageEnhancements(page);
  await updateHUD(page, 'ACT IV: ARCHITECTURE', 'Enterprise Microservice Stack', 'PyTorch • FastAPI • Spring Boot 3.4 • PostgreSQL 17 / PostGIS 3.5 • React 19', '#10b981');
  await moveVirtualCursor(page, 520, 360);

  await waitUntil(193.0);
  await moveVirtualCursor(page, 960, 440);

  await waitUntil(198.02);

  // --------------------------------------------------------------------------
  // SCENE 11 (198.02s - 213.29s): Act V: Grand Closing Callout - SIH 2026
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

  console.log(`\nCaptured ${frames.length} total frames for Dual Master Demo.`);

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
  const audioFile = path.resolve('outputs/voiceover_dual_master/master.mp3').replace(/\\/g, '/');
  const outFile = path.resolve('outputs/videos/AIDRS_SIH_Dual_Master_1080p.mp4').replace(/\\/g, '/');
  
  console.log('Encoding AIDRS_SIH_Dual_Master_1080p.mp4 with FFmpeg...');
  const encodeCmd = `"${FFMPEG_PATH}" -y -f concat -safe 0 -i "${concatFile}" -i "${audioFile}" -c:v libx264 -pix_fmt yuv420p -r 25 -c:a aac -b:a 192k -t ${TARGET_TOTAL_DUR} "${outFile}"`;
  execSync(encodeCmd, { stdio: 'inherit' });

  const stats = fs.statSync(outFile);
  console.log(`\n========================================================================`);
  console.log(`>>> MASTERPIECE VIDEO CREATED SUCCESSFULLY: ${outFile}`);
  console.log(`>>> Video Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`>>> Total Run Time: ${TARGET_TOTAL_DUR}s`);
  console.log(`========================================================================\n`);
  return outFile;
}

recordDualMasterDemo().catch(console.error);
