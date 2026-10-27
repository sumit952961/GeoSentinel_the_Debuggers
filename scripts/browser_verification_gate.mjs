import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const puppeteer = require('../frontend/node_modules/puppeteer-core');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SCREENSHOTS_DIR = path.join(ROOT_DIR, 'frontend', 'public', 'test_screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runBrowserVerification() {
  console.log('='.repeat(70));
  console.log(' DRAS HUMAN EXAMINER BROWSER VERIFICATION GATE');
  console.log('='.repeat(70));

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--use-gl=angle',
      '--use-angle=d3d11',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--window-size=1600,1000'
    ],
    defaultViewport: { width: 1600, height: 1000 }
  });

  const page = await browser.newPage();

  const consoleLogs = [];
  const pageErrors = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    if (msg.type() === 'error') {
      console.log(`[BROWSER CONSOLE ERROR]: ${text}`);
    }
  });

  page.on('pageerror', err => {
    const s = err.stack || err.toString();
    pageErrors.push(s);
    console.log(`[PAGE ERROR STACK]:\n${s}`);
  });

  try {
    // ----------------------------------------------------
    // TEST 1: Chamoli Scenario (Scenario 2) in 2D Mode
    // ----------------------------------------------------
    console.log('\n--- 1. Testing Chamoli (Scenario 2) in 2D Mode ---');
    await page.goto('http://localhost:5173/map/2', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2500);

    // Switch to 2D view to verify 2D Leaflet rendering first
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b2d = btns.find(b => b.innerText.includes('2D'));
      if (b2d) b2d.click();
    });
    console.log('  Switched to 2D Map mode');
    await sleep(2000);

    // Capture 2D Overview screenshot
    const shot1 = path.join(SCREENSHOTS_DIR, '01_chamoli_2d_overview.png');
    await page.screenshot({ path: shot1 });
    console.log(`  Screenshot saved: ${shot1}`);

    // Verify 2D Leaflet Elements
    const leafletInfo = await page.evaluate(() => {
      const paths = document.querySelectorAll('.leaflet-pane svg path');
      const markers = document.querySelectorAll('.leaflet-marker-icon');
      const colors = new Set();
      paths.forEach(p => {
        const fill = p.getAttribute('fill');
        const stroke = p.getAttribute('stroke');
        if (fill && fill !== 'none') colors.add(fill.toLowerCase());
        if (stroke && stroke !== 'none') colors.add(stroke.toLowerCase());
      });
      return {
        pathCount: paths.length,
        markerCount: markers.length,
        colors: Array.from(colors)
      };
    });
    console.log(`  2D Leaflet Render Stats: Paths=${leafletInfo.pathCount}, Markers=${leafletInfo.markerCount}`);
    console.log(`  Color Palette Detected:`, leafletInfo.colors);

    // ----------------------------------------------------
    // TEST 2: Building Selection & Satellite Evidence
    // ----------------------------------------------------
    console.log('\n--- 2. Testing Building Click & Evidence Inspector ---');
    const bBox = await page.evaluate(() => {
      const paths = Array.from(document.querySelectorAll('.leaflet-pane svg path'));
      const target = paths.find(p => {
        const f = (p.getAttribute('fill') || '').toLowerCase();
        return f === '#ef4444' || f === '#f97316' || f === '#dc2626' || f === '#ea580c';
      }) || paths[0];

      if (target) {
        const rect = target.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      }
      return null;
    });

    if (bBox) {
      await page.mouse.click(bBox.x, bBox.y);
      console.log(`  Native mouse clicked building at (${bBox.x.toFixed(0)}, ${bBox.y.toFixed(0)})`);
    } else {
      console.log('  No building SVG path found to click');
    }

    await sleep(2000);
    const shot2 = path.join(SCREENSHOTS_DIR, '02_chamoli_building_inspector.png');
    await page.screenshot({ path: shot2 });
    console.log(`  Screenshot saved: ${shot2}`);

    // Check inspector drawer content
    const inspectorData = await page.evaluate(() => {
      const drawer = document.querySelector('div[style*="width: 380px"], div[style*="width: 360px"], div[style*="overflow-y: auto"]');
      const text = drawer ? drawer.innerText : '';
      const imgs = Array.from(document.querySelectorAll('img[src*="satellite_evidence"]')).map(img => ({
        src: img.src,
        complete: img.complete,
        naturalWidth: img.naturalWidth
      }));
      return {
        hasStructureId: /Structure #|Building/i.test(text),
        hasPriority: /Priority/i.test(text),
        hasDamage: /Damage|Destroyed|Major/i.test(text),
        hasEvidenceHeader: /Satellite Evidence/i.test(text),
        hasActionButtons: /Generate Response Access Route|Evacuate/i.test(text),
        images: imgs,
        previewText: text.substring(0, 300)
      };
    });
    console.log('  Inspector Analysis:', inspectorData);

    // ----------------------------------------------------
    // TEST 3: Routing Generation Test (Response Access & Evacuation)
    // ----------------------------------------------------
    console.log('\n--- 3. Testing Routing Generation ---');
    // Click "03 RESPOND" Tab or Response Access button
    const routingClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const respBtn = btns.find(b => b.innerText.includes('03 RESPOND') || b.innerText.includes('RESPOND'));
      if (respBtn) {
        respBtn.click();
        return true;
      }
      return false;
    });
    await sleep(1500);

    const shot3 = path.join(SCREENSHOTS_DIR, '03_chamoli_routing_mode.png');
    await page.screenshot({ path: shot3 });
    console.log(`  Screenshot saved: ${shot3}`);

    // ----------------------------------------------------
    // TEST 4: 3D Cesium Earth Visual Test
    // ----------------------------------------------------
    console.log('\n--- 4. Testing 3D Cesium View Mode ---');
    // Switch to 3D Globe
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b3d = btns.find(b => b.innerText.includes('3D'));
      if (b3d) b3d.click();
    });
    console.log('  Switched to 3D Earth mode');
    await sleep(4000); // Give Cesium time to render terrain and entities

    const shot4 = path.join(SCREENSHOTS_DIR, '04_chamoli_3d_cesium.png');
    await page.screenshot({ path: shot4 });
    console.log(`  Screenshot saved: ${shot4}`);

    // Check Cesium canvas and WebGL context
    const cesiumStats = await page.evaluate(() => {
      const canvas = document.querySelector('.cesium-widget canvas');
      if (!canvas) return { hasCanvas: false };
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      return {
        hasCanvas: true,
        width: canvas.width,
        height: canvas.height,
        webgl: gl ? 'Active' : 'Missing',
        vendor: gl ? gl.getParameter(gl.VENDOR) : 'N/A',
        renderer: gl ? gl.getParameter(gl.RENDERER) : 'N/A'
      };
    });
    console.log('  Cesium WebGL Status:', cesiumStats);

    // ----------------------------------------------------
    // TEST 5: 6-Step Guided Demo Walkthrough Execution
    // ----------------------------------------------------
    console.log('\n--- 5. Executing 6-Step Demo Walkthrough ---');
    // Click "▶️ 6-STEP DEMO WALKTHROUGH"
    const walkthroughStarted = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const demoBtn = btns.find(b => b.innerText.includes('DEMO WALKTHROUGH') || b.innerText.includes('WALKTHROUGH'));
      if (demoBtn) {
        demoBtn.click();
        return true;
      }
      return false;
    });
    console.log(`  Demo Walkthrough Launcher Clicked: ${walkthroughStarted}`);
    await sleep(1500);

    for (let step = 1; step <= 6; step++) {
      const stepShot = path.join(SCREENSHOTS_DIR, `05_demo_step_${step}.png`);
      await page.screenshot({ path: stepShot });
      console.log(`  [DEMO STEP ${step}/6] Screenshot: ${stepShot}`);

      // Click "Next Step ➡️" if not at final step
      if (step < 6) {
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const nextBtn = btns.find(b => b.innerText.includes('Next Step') || b.innerText.includes('Next'));
          if (nextBtn) nextBtn.click();
        });
        await sleep(1200);
      }
    }

    // ----------------------------------------------------
    // TEST 6: Other Scenarios Verification (Fani, Dharali, Malibu)
    // ----------------------------------------------------
    console.log('\n--- 6. Verifying Scenarios 3, 4, 1 ---');
    for (const sid of [3, 4, 1]) {
      await page.goto(`http://localhost:5173/map/${sid}`, { waitUntil: 'networkidle2', timeout: 25000 });
      await sleep(2000);
      const sShot = path.join(SCREENSHOTS_DIR, `06_scenario_${sid}_loaded.png`);
      await page.screenshot({ path: sShot });
      console.log(`  Scenario ${sid} Loaded Screenshot: ${sShot}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log(' BROWSER VERIFICATION SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total Console Errors: ${consoleLogs.filter(l => l.type === 'error').length}`);
    console.log(`Total Page Errors:    ${pageErrors.length}`);
    if (pageErrors.length > 0) {
      console.log('Page Errors List:', pageErrors);
    }
  } catch (err) {
    console.error('Browser Test Failed with Exception:', err);
  } finally {
    await browser.close();
  }
}

runBrowserVerification().catch(console.error);
