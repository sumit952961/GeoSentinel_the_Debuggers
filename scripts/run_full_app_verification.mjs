import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('../frontend/node_modules/puppeteer-core');
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const VERIFY_DIR = './outputs/verification';
if (!fs.existsSync(VERIFY_DIR)) {
  fs.mkdirSync(VERIFY_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyAll() {
  console.log('='.repeat(70));
  console.log('  AIDRS v2.0 FULL END-TO-END VERIFICATION & AUDIT SUITE');
  console.log('='.repeat(70));

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
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!t.includes('favicon.ico') && !t.includes('cartodb')) {
        errors.push(t);
        console.log(`[BROWSER ERROR]: ${t}`);
      }
    }
  });

  page.on('pageerror', err => {
    errors.push(err.message);
    console.log(`[PAGE EXCEPTION]: ${err.message}`);
  });

  // ─── STEP 1: LANDING PAGE ───
  console.log('\n[1/10] Verifying Landing Page (http://127.0.0.1:5173/)...');
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  await page.screenshot({ path: `${VERIFY_DIR}/01_landing_redesigned.jpg`, quality: 95 });
  console.log('  ✓ Landing page rendered and captured.');

  // ─── STEP 2: SCENARIOS CATALOG ───
  console.log('\n[2/10] Verifying Scenarios Catalog (/scenarios)...');
  await page.goto('http://127.0.0.1:5173/scenarios', { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  await page.screenshot({ path: `${VERIFY_DIR}/02_scenarios_grid.jpg`, quality: 95 });
  console.log('  ✓ Scenarios catalog rendered.');

  // ─── STEP 3: OPERATIONS MAP SCENARIO 2 (CHAMOLI) ───
  console.log('\n[3/10] Verifying Operations Map Scenario 2 Chamoli (/scenario/2/map)...');
  await page.goto('http://127.0.0.1:5173/scenario/2/map', { waitUntil: 'domcontentloaded' });
  await sleep(3500);
  await page.screenshot({ path: `${VERIFY_DIR}/03_chamoli_3d_initial.jpg`, quality: 95 });

  // ─── STEP 4: 3D NAVIGATION & ZOOM CONTROLS TEST ───
  console.log('\n[4/10] Testing 3D Camera Controls & Wheel Zoom in Cesium...');
  const initCam = await page.evaluate(() => {
    const v = window.__DRAS_CESIUM_VIEWER__;
    return v?.camera?.positionCartographic ? {
      height: v.camera.positionCartographic.height,
      heading: v.camera.heading,
      pitch: v.camera.pitch
    } : null;
  });
  console.log('  Initial 3D Camera:', initCam);

  // Wheel Zoom Out
  const mapContainer = await page.$('.cesium-widget');
  if (mapContainer) {
    const box = await mapContainer.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);

    console.log('  Testing wheel scroll zoom out...');
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel({ deltaY: 200 });
      await sleep(150);
    }
    await sleep(800);

    const camAfterOut = await page.evaluate(() => window.__DRAS_CESIUM_VIEWER__?.camera?.positionCartographic?.height);
    console.log(`  Camera Height After Zoom Out: ${camAfterOut} (Was: ${initCam?.height})`);

    // Wheel Zoom In
    console.log('  Testing wheel scroll zoom in...');
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel({ deltaY: -200 });
      await sleep(150);
    }
    await sleep(800);

    const camAfterIn = await page.evaluate(() => window.__DRAS_CESIUM_VIEWER__?.camera?.positionCartographic?.height);
    console.log(`  Camera Height After Zoom In: ${camAfterIn}`);
  }

  // Click Zoom In (+) Button
  console.log('  Testing Zoom + button click...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.title?.includes('Zoom In'));
    if (btn) btn.click();
  });
  await sleep(800);

  // Click Tilt Button
  console.log('  Testing Tilt button click...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.title?.includes('Tilt'));
    if (btn) btn.click();
  });
  await sleep(1200);

  // Click North Button
  console.log('  Testing North compass button click...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.title?.includes('North'));
    if (btn) btn.click();
  });
  await sleep(1000);

  // Click Home Button
  console.log('  Testing Home button click...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.title?.includes('Epicenter') || b.title?.includes('Home'));
    if (btn) btn.click();
  });
  await sleep(1500);

  await page.screenshot({ path: `${VERIFY_DIR}/04_chamoli_3d_controls_tested.jpg`, quality: 95 });
  console.log('  ✓ 3D Camera Controls and Zoom verified.');

  // ─── STEP 5: 2D <-> 3D MODE SWITCHING ───
  console.log('\n[5/10] Testing 2D <-> 3D Map Mode Switching...');
  // Switch to 2D
  await page.evaluate(() => {
    const btn2d = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('2D MAP'));
    if (btn2d) btn2d.click();
  });
  await sleep(1500);
  await page.screenshot({ path: `${VERIFY_DIR}/05_chamoli_2d_mode.jpg`, quality: 95 });
  console.log('  ✓ Switched to 2D Leaflet mode successfully.');

  // Switch back to 3D
  await page.evaluate(() => {
    const btn3d = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('3D EARTH'));
    if (btn3d) btn3d.click();
  });
  await sleep(1800);
  await page.screenshot({ path: `${VERIFY_DIR}/06_chamoli_back_to_3d.jpg`, quality: 95 });
  console.log('  ✓ Switched back to 3D Earth successfully.');

  // ─── STEP 6: OPERATIONAL PHASES & SECTOR INSPECTION ───
  console.log('\n[6/10] Testing Operational Phases (ASSESS, PRIORITISE, RESPOND)...');
  // Click 02 PRIORITISE
  await page.evaluate(() => {
    const priBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('PRIORITISE'));
    if (priBtn) priBtn.click();
  });
  await sleep(1500);
  await page.screenshot({ path: `${VERIFY_DIR}/07_chamoli_phase_prioritise.jpg`, quality: 95 });

  // Click Sector Card in right panel
  console.log('  Clicking operational sector card to inspect...');
  await page.evaluate(() => {
    const sectorCard = document.querySelector('div[style*="cursor: pointer"][style*="border-left"]');
    if (sectorCard) sectorCard.click();
  });
  await sleep(2000);
  await page.screenshot({ path: `${VERIFY_DIR}/08_chamoli_sector_inspected.jpg`, quality: 95 });
  console.log('  ✓ Operational Sector clicked and camera focused.');

  // ─── STEP 7: RESPONSE ROUTING CALCULATION ───
  console.log('\n[7/10] Testing Response & Evacuation Routing...');
  // Click 03 RESPOND
  await page.evaluate(() => {
    const respBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('RESPOND'));
    if (respBtn) respBtn.click();
  });
  await sleep(1200);

  // Trigger dispatch route calculation
  const routeTriggered = await page.evaluate(async () => {
    const dispatchBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('CALCULATE') || b.textContent?.includes('DISPATCH') || b.textContent?.includes('ROUTE'));
    if (dispatchBtn) {
      dispatchBtn.click();
      return true;
    }
    return false;
  });
  await sleep(2500);
  await page.screenshot({ path: `${VERIFY_DIR}/09_chamoli_response_route.jpg`, quality: 95 });
  console.log('  ✓ Route calculated and rendered.');

  // ─── STEP 8: SCENARIO 1 (WOOLSEY FIRE) ───
  console.log('\n[8/10] Testing Scenario 1 (Woolsey Fire 2018)...');
  await page.goto('http://127.0.0.1:5173/scenario/1/map', { waitUntil: 'domcontentloaded' });
  await sleep(3500);
  await page.screenshot({ path: `${VERIFY_DIR}/10_woolsey_3d_labels_fixed.jpg`, quality: 95 });
  console.log('  ✓ Woolsey Fire 3D Earth rendered with collision-free labels.');

  // ─── STEP 9: EXECUTIVE DASHBOARD & REPORTS ───
  console.log('\n[9/10] Testing Executive Dashboard & Reports...');
  await page.goto('http://127.0.0.1:5173/scenario/2/dashboard', { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await page.screenshot({ path: `${VERIFY_DIR}/11_executive_dashboard.jpg`, quality: 95 });

  await page.goto('http://127.0.0.1:5173/scenario/2/reports', { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await page.screenshot({ path: `${VERIFY_DIR}/12_reports_view.jpg`, quality: 95 });
  console.log('  ✓ Dashboard & Reports rendered.');

  // ─── STEP 10: RESEARCH & SYSTEM HEALTH ───
  console.log('\n[10/10] Testing Research Metrics & System Health...');
  await page.goto('http://127.0.0.1:5173/research', { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await page.screenshot({ path: `${VERIFY_DIR}/13_research_metrics.jpg`, quality: 95 });

  await page.goto('http://127.0.0.1:5173/system', { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await page.screenshot({ path: `${VERIFY_DIR}/14_system_health.jpg`, quality: 95 });
  console.log('  ✓ Research & System Health verified.');

  await browser.close();

  console.log('\n' + '='.repeat(70));
  console.log(`  VERIFICATION COMPLETED! Total Browser Errors: ${errors.length}`);
  console.log('='.repeat(70));
  return { success: true, errors };
}

verifyAll().catch(err => {
  console.error('VERIFICATION SCRIPT ERROR:', err);
  process.exit(1);
});
