import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('../frontend/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const FFMPEG_PATH = 'C:\\Users\\rajat\\AppData\\Roaming\\Python\\Python313\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe';
const CLOSING_HTML_PATH = 'file:///' + path.resolve('scripts/closing_card.html').replace(/\\/g, '/');

// Helpers for HUD, Cursor, and Continuous Heartbeat
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
    // 1. Continuous Heartbeat Animator: forces Chrome to emit screencast frames smoothly at ~25fps
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

// -------------------------------------------------------------
// FULL DEMO RECORDER (Target 102.48s matching outputs/voiceover_full/master.mp3)
// -------------------------------------------------------------
async function recordFullDemo() {
  const TARGET_TOTAL_DUR = 102.48;
  console.log('\n======================================================');
  console.log(`RECORDING FULL DEMO (Strict Sync: ${TARGET_TOTAL_DUR}s)`);
  console.log('======================================================');

  const tempDir = './outputs/temp_full_frames';
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

  // ---------------------------------------------------------
  // SCENE 1 (0.00s - 14.13s): Hook & Incident Overview
  // ---------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 1: Hook & Incident Overview (0.00s - 14.13s)`);
  await updateHUD(page, 'SYSTEM OVERVIEW', 'AI-Driven Disaster Response Intelligence System', 'ASSESS → PRIORITISE → RESPOND Autonomous Pipeline', '#0284c7');
  await moveVirtualCursor(page, 960, 420);

  await waitUntil(4.0);
  console.log(`[${elapsed().toFixed(1)}s] Scrolling to 3-step pipeline...`);
  for (let i = 0; i < 22; i++) {
    await page.evaluate(() => window.scrollBy(0, 24));
    await new Promise(r => setTimeout(r, 60));
  }
  await moveVirtualCursor(page, 520, 500);

  await waitUntil(9.5);
  console.log(`[${elapsed().toFixed(1)}s] Scrolling to scenarios grid...`);
  for (let i = 0; i < 18; i++) {
    await page.evaluate(() => window.scrollBy(0, 25));
    await new Promise(r => setTimeout(r, 60));
  }
  await moveVirtualCursor(page, 420, 520, true);

  await waitUntil(14.13);

  // ---------------------------------------------------------
  // SCENE 2 (14.13s - 27.73s): ASSESS - AI Damage Classification
  // ---------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 2: Loading 2D Map & Building Footprints (14.13s - 27.73s)`);
  await page.goto('http://localhost:5173/scenario/1/map', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1500));
  await initPageEnhancements(page);

  await page.evaluate(() => {
    if (window.__DRAS_SET_MAP_VIEW_MODE__) window.__DRAS_SET_MAP_VIEW_MODE__('2D');
  });
  await new Promise(r => setTimeout(r, 800));

  await page.evaluate(() => {
    if (window.__DRAS_MAP__) window.__DRAS_MAP__.setView([34.0724, -118.7253], 15);
  });
  await updateHUD(page, 'PHASE 01: ASSESS', 'AI Building Damage Classification', '181 Structures Localised & Classified across 4 Damage Tiers', '#10b981');
  await moveVirtualCursor(page, 720, 520);

  await waitUntil(21.0);
  console.log(`[${elapsed().toFixed(1)}s] Panning across building damage cluster...`);
  for (let i = 0; i < 35; i++) {
    await page.evaluate(() => {
      if (window.__DRAS_MAP__) window.__DRAS_MAP__.panBy([5, 2], { animate: false });
    });
    await new Promise(r => setTimeout(r, 90));
  }

  await waitUntil(27.73);

  // ---------------------------------------------------------
  // SCENE 3 (27.73s - 42.49s): PRIORITISE - Explainable Triage
  // ---------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 3: Selecting Critical Building & Inspecting Triage (27.73s - 42.49s)`);
  await moveVirtualCursor(page, 760, 480, true);
  await new Promise(r => setTimeout(r, 400));

  await page.evaluate(() => {
    if (window.__DRAS_SELECT_BUILDING__) window.__DRAS_SELECT_BUILDING__('destroyed');
  });
  await updateHUD(page, 'PHASE 02: PRIORITISE', 'Explainable Multi-Factor Triage Scoring', 'Score: 0.40·Severity + 0.25·Population + 0.20·Infrastructure + 0.15·Accessibility', '#f59e0b');

  await waitUntil(32.5);
  console.log(`[${elapsed().toFixed(1)}s] Highlighting satellite evidence & triage breakdown...`);
  await moveVirtualCursor(page, 1720, 260); // AI Satellite Evidence
  await waitUntil(37.5);
  await moveVirtualCursor(page, 1720, 620); // Priority breakdown bars

  await waitUntil(42.49);

  // ---------------------------------------------------------
  // SCENE 4 (42.49s - 54.46s): Road Hazard Analysis
  // ---------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 4: Road Hazard & Blocked Corridor Analysis (42.49s - 54.46s)`);
  await updateHUD(page, 'SITUATIONAL AWARENESS', 'Active Road Network & Blockage Flagging', 'Dynamic Detection of Blocked Corridors (Violet Dashed Corridor)', '#a855f7');
  
  await page.evaluate(() => {
    if (window.__DRAS_MAP__) window.__DRAS_MAP__.setView([34.058, -118.74], 14, { animate: true });
  });
  await moveVirtualCursor(page, 920, 420);

  await waitUntil(47.5);
  console.log(`[${elapsed().toFixed(1)}s] Highlighting road corridors...`);
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => {
      if (window.__DRAS_MAP__) window.__DRAS_MAP__.panBy([-3, 4], { animate: false });
    });
    await new Promise(r => setTimeout(r, 100));
  }

  await waitUntil(54.46);

  // ---------------------------------------------------------
  // SCENE 5 (54.46s - 66.77s): RESPOND - Access Routing
  // ---------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 5: Calculating Response Access Route (54.46s - 66.77s)`);
  await moveVirtualCursor(page, 1720, 840, true);
  await new Promise(r => setTimeout(r, 500));

  await page.evaluate(() => {
    if (window.__DRAS_CALCULATE_ROUTE__) window.__DRAS_CALCULATE_ROUTE__('RESPONSE');
  });
  await updateHUD(page, 'PHASE 03: RESPOND', 'Hazard-Aware Dijkstra Access Routing', 'Optimal Corridor: Incident Staging Base → Target Structure (Detouring Closure)', '#ea580c');
  
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => {
    if (window.__DRAS_MAP__) window.__DRAS_MAP__.setView([34.048, -118.735], 13, { animate: true });
  });

  await waitUntil(59.0);
  await moveVirtualCursor(page, 1150, 720); // Coastal staging base
  await waitUntil(63.0);
  await moveVirtualCursor(page, 680, 260); // Target building

  await waitUntil(66.77);

  // ---------------------------------------------------------
  // SCENE 6 (66.77s - 77.97s): RESPOND - Civilian Evacuation Routing
  // ---------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 6: Calculating Evacuation Route to Hospital (66.77s - 77.97s)`);
  await moveVirtualCursor(page, 1720, 875, true);
  await new Promise(r => setTimeout(r, 500));

  await page.evaluate(() => {
    if (window.__DRAS_CALCULATE_ROUTE__) window.__DRAS_CALCULATE_ROUTE__('EVACUATION', 'hospital');
  });
  await updateHUD(page, 'PHASE 03: RESPOND', 'Civilian Evacuation Route to Medical Facility', 'Real-Time PostGIS Query: Target Structure → Malibu Urgent Care Center', '#06b6d4');

  await new Promise(r => setTimeout(r, 1200));
  await moveVirtualCursor(page, 1100, 775); // Malibu Urgent Care Center

  await waitUntil(77.97);

  // ---------------------------------------------------------
  // SCENE 7 (77.97s - 90.11s): Multi-Scenario Generalisation & Architecture
  // ---------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 7: Multi-Scenario Generalisation & Architecture (77.97s - 90.11s)`);
  await page.goto('http://localhost:5173/scenarios', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1200));
  await initPageEnhancements(page);
  await updateHUD(page, 'GENERALISATION', 'Multi-Hazard Scenario Coverage', 'Wildfire • Chamoli Flash Flood (Verified EIDC) • Cyclone Fani • Dharali', '#3b82f6');
  await moveVirtualCursor(page, 520, 360);

  await waitUntil(84.0);
  console.log(`[${elapsed().toFixed(1)}s] Showing System Infrastructure Health...`);
  await page.goto('http://localhost:5173/system', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1200));
  await initPageEnhancements(page);
  await updateHUD(page, 'ARCHITECTURE', 'Enterprise Microservice Stack', 'FastAPI • Spring Boot 3.4 • PostgreSQL 17 / PostGIS 3.5 • React 19', '#10b981');
  await moveVirtualCursor(page, 500, 380);

  await waitUntil(90.11);

  // ---------------------------------------------------------
  // SCENE 8 (90.11s - 102.48s): Closing Title Card
  // ---------------------------------------------------------
  console.log(`[${elapsed().toFixed(1)}s] Scene 8: Final Callout Frame (90.11s - 102.48s)`);
  await page.goto(CLOSING_HTML_PATH, { waitUntil: 'domcontentloaded' });
  await initPageEnhancements(page);

  while (elapsed() < TARGET_TOTAL_DUR) {
    const curTime = elapsed();
    const cursorX = 860 + Math.sin(curTime * 1.5) * 120;
    const cursorY = 560 + Math.cos(curTime * 1.5) * 40;
    await moveVirtualCursor(page, cursorX, cursorY);
    await new Promise(r => setTimeout(r, 60));
  }

  console.log(`[${elapsed().toFixed(1)}s] Stopping screencast recording...`);
  await client.send('Page.stopScreencast');
  await browser.close();

  console.log(`\nCaptured ${frames.length} total frames for Full Demo.`);

  // Build ffconcat file with exact duration coverage
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
  const audioFile = path.resolve('outputs/voiceover_full/master.mp3').replace(/\\/g, '/');
  const outFile = path.resolve('outputs/videos/AIDRS_SIH_Demo_Full.mp4').replace(/\\/g, '/');
  
  console.log('Encoding AIDRS_SIH_Demo_Full.mp4 with FFmpeg...');
  const encodeCmd = `"${FFMPEG_PATH}" -y -f concat -safe 0 -i "${concatFile}" -i "${audioFile}" -c:v libx264 -pix_fmt yuv420p -r 25 -c:a aac -b:a 192k -t ${TARGET_TOTAL_DUR} "${outFile}"`;
  execSync(encodeCmd, { stdio: 'inherit' });

  const stats = fs.statSync(outFile);
  console.log(`\n>>> Full Demo video created successfully: ${outFile}`);
  console.log(`>>> Video Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  return outFile;
}

// -------------------------------------------------------------
// SHORT DEMO RECORDER (Target 64.10s matching outputs/voiceover_60s/master.mp3)
// -------------------------------------------------------------
async function recordShortDemo() {
  const TARGET_TOTAL_DUR = 64.10;
  console.log('\n======================================================');
  console.log(`RECORDING SHORT DEMO (Strict Sync: ${TARGET_TOTAL_DUR}s)`);
  console.log('======================================================');

  const tempDir = './outputs/temp_short_frames';
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

  // Scene 1: Hook (0.00s - 10.08s)
  await updateHUD(page, 'SYSTEM OVERVIEW', 'AI-Driven Disaster Response Intelligence System', 'Assess • Prioritise • Respond', '#0284c7');
  await waitUntil(3.0);
  for (let i = 0; i < 18; i++) {
    await page.evaluate(() => window.scrollBy(0, 20));
    await new Promise(r => setTimeout(r, 50));
  }
  await moveVirtualCursor(page, 420, 520, true);
  await waitUntil(10.08);

  // Scene 2: ASSESS (10.08s - 21.21s)
  await page.goto('http://localhost:5173/scenario/1/map', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1200));
  await initPageEnhancements(page);
  await page.evaluate(() => {
    if (window.__DRAS_SET_MAP_VIEW_MODE__) window.__DRAS_SET_MAP_VIEW_MODE__('2D');
  });
  await new Promise(r => setTimeout(r, 600));
  await page.evaluate(() => {
    if (window.__DRAS_MAP__) window.__DRAS_MAP__.setView([34.0724, -118.7253], 15);
  });
  await updateHUD(page, 'STAGE 01: ASSESS', 'AI Building Damage Classification', 'Dual-Stage ResNet U-Net: 181 Structures across 4 Damage Tiers', '#10b981');
  await waitUntil(21.21);

  // Scene 3: PRIORITISE (21.21s - 32.49s)
  await page.evaluate(() => {
    if (window.__DRAS_SELECT_BUILDING__) window.__DRAS_SELECT_BUILDING__('destroyed');
  });
  await updateHUD(page, 'STAGE 02: PRIORITISE', 'Explainable Multi-Factor Triage', 'Formula: Priority = 0.40·S + 0.25·P + 0.20·I + 0.15·A', '#f59e0b');
  await moveVirtualCursor(page, 1720, 260);
  await waitUntil(27.0);
  await moveVirtualCursor(page, 1720, 620);
  await waitUntil(32.49);

  // Scene 4: RESPOND Access Route (32.49s - 43.86s)
  await moveVirtualCursor(page, 1720, 840, true);
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => {
    if (window.__DRAS_CALCULATE_ROUTE__) window.__DRAS_CALCULATE_ROUTE__('RESPONSE');
  });
  await updateHUD(page, 'STAGE 03: RESPOND', 'Hazard-Aware Dijkstra Routing', 'Optimal Corridor: Incident Staging Base → Target Site (Detouring Blockade)', '#ea580c');
  await page.evaluate(() => {
    if (window.__DRAS_MAP__) window.__DRAS_MAP__.setView([34.048, -118.735], 13, { animate: true });
  });
  await waitUntil(43.86);

  // Scene 5: Evacuation (43.86s - 51.56s)
  await moveVirtualCursor(page, 1720, 875, true);
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => {
    if (window.__DRAS_CALCULATE_ROUTE__) window.__DRAS_CALCULATE_ROUTE__('EVACUATION', 'hospital');
  });
  await updateHUD(page, 'STAGE 03: RESPOND', 'Civilian Evacuation Route', 'Optimal Route: Target Site → Malibu Urgent Care Center', '#06b6d4');
  await waitUntil(51.56);

  // Scene 6: Generalisation & Closing (51.56s - 64.10s)
  await page.goto(CLOSING_HTML_PATH, { waitUntil: 'domcontentloaded' });
  await initPageEnhancements(page);
  while (elapsed() < TARGET_TOTAL_DUR) {
    const curTime = elapsed();
    const cursorX = 860 + Math.sin(curTime * 1.5) * 120;
    const cursorY = 560 + Math.cos(curTime * 1.5) * 40;
    await moveVirtualCursor(page, cursorX, cursorY);
    await new Promise(r => setTimeout(r, 60));
  }

  await client.send('Page.stopScreencast');
  await browser.close();

  // Encode
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

  const audioFile = path.resolve('outputs/voiceover_60s/master.mp3').replace(/\\/g, '/');
  const outFile = path.resolve('outputs/videos/AIDRS_SIH_Demo_60s.mp4').replace(/\\/g, '/');
  
  console.log('Encoding AIDRS_SIH_Demo_60s.mp4 with FFmpeg...');
  const encodeCmd = `"${FFMPEG_PATH}" -y -f concat -safe 0 -i "${concatFile}" -i "${audioFile}" -c:v libx264 -pix_fmt yuv420p -r 25 -c:a aac -b:a 192k -t ${TARGET_TOTAL_DUR} "${outFile}"`;
  execSync(encodeCmd, { stdio: 'inherit' });

  const stats = fs.statSync(outFile);
  console.log(`\n>>> Short Demo video created successfully: ${outFile}`);
  console.log(`>>> Video Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  return outFile;
}

async function main() {
  const fullVideo = await recordFullDemo();
  const shortVideo = await recordShortDemo();

  console.log('\n======================================================');
  console.log('ALL VIDEOS GENERATED AND SYNCHRONIZED SUCCESSFULLY:');
  console.log('1. Full Demo (102.48s):', fullVideo);
  console.log('2. Short Demo (64.10s):', shortVideo);
  console.log('======================================================\n');
}

main().catch(console.error);
