import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('../frontend/node_modules/puppeteer-core');
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUTPUT_DIR = './outputs/audit';
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function audit() {
  console.log('--- Launching Browser for AIDRS Audit ---');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-web-security',
      '--use-gl=angle',
      '--use-angle=d3d11',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--window-size=1536,864'
    ],
    defaultViewport: { width: 1536, height: 864 }
  });

  const page = await browser.newPage();
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
    if (msg.type() === 'error') {
      console.log('PAGE ERROR:', msg.text());
    }
  });

  page.on('pageerror', err => {
    console.log('UNCAUGHT EXCEPTION:', err.message);
  });

  // 1. Audit Landing Page
  console.log('1. Checking Landing Page (http://127.0.0.1:5173/)...');
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: `${OUTPUT_DIR}/01_landing_page.jpg`, quality: 90 });

  // 2. Audit Scenarios Page
  console.log('2. Checking Scenarios (/scenarios)...');
  await page.goto('http://127.0.0.1:5173/scenarios', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: `${OUTPUT_DIR}/02_scenarios.jpg`, quality: 90 });

  // 3. Audit Operations Map (Scenario 1)
  console.log('3. Checking Operations Map Scenario 1 (/scenario/1/map)...');
  await page.goto('http://127.0.0.1:5173/scenario/1/map', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 4000));
  await page.screenshot({ path: `${OUTPUT_DIR}/03_map_scenario1_initial.jpg`, quality: 90 });

  // Check Cesium canvas and controls
  const cesiumCanvas = await page.$('.cesium-widget-canvas');
  console.log('Cesium widget canvas found:', !!cesiumCanvas);

  // Check window global objects exposed by Cesium
  const globeInfo = await page.evaluate(() => {
    const viewer = window.__DRAS_CESIUM_VIEWER__;
    if (!viewer) return { hasViewer: false };
    const camera = viewer.camera;
    return {
      hasViewer: true,
      positionCartographic: camera.positionCartographic ? {
        lon: camera.positionCartographic.longitude,
        lat: camera.positionCartographic.latitude,
        height: camera.positionCartographic.height
      } : null,
      heading: camera.heading,
      pitch: camera.pitch,
      roll: camera.roll
    };
  });
  console.log('Globe Info:', globeInfo);

  // Test Wheel Zoom
  if (cesiumCanvas) {
    const box = await cesiumCanvas.boundingBox();
    console.log('Canvas Box:', box);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);

    const initialHeight = globeInfo.positionCartographic?.height;

    // Scroll down (zoom out)
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel({ deltaY: 300 });
      await new Promise(r => setTimeout(r, 100));
    }
    await new Promise(r => setTimeout(r, 1000));

    const zoomedOutHeight = await page.evaluate(() => {
      const v = window.__DRAS_CESIUM_VIEWER__;
      return v?.camera?.positionCartographic?.height;
    });
    console.log(`Initial Height: ${initialHeight} -> After Wheel Zoom Out: ${zoomedOutHeight}`);

    // Scroll up (zoom in)
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel({ deltaY: -300 });
      await new Promise(r => setTimeout(r, 100));
    }
    await new Promise(r => setTimeout(r, 1000));

    const zoomedInHeight = await page.evaluate(() => {
      const v = window.__DRAS_CESIUM_VIEWER__;
      return v?.camera?.positionCartographic?.height;
    });
    console.log(`After Wheel Zoom In: ${zoomedInHeight}`);
    await page.screenshot({ path: `${OUTPUT_DIR}/04_map_after_zoom.jpg`, quality: 90 });
  }

  // 4. Test Scenario 2 (Chamoli Flash Flood)
  console.log('4. Checking Scenario 2 (Chamoli)...');
  await page.goto('http://127.0.0.1:5173/scenario/2/map', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 4000));
  await page.screenshot({ path: `${OUTPUT_DIR}/05_chamoli_3d.jpg`, quality: 90 });

  await browser.close();
  console.log('--- Audit Completed Successfully ---');
}

audit().catch(console.error);
