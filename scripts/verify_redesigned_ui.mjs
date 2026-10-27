import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const puppeteer = require('../frontend/node_modules/puppeteer-core');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SCREENSHOTS_DIR = path.join(ROOT_DIR, 'frontend', 'public', 'test_screenshots', 'redesign');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runRedesignVerification() {
  console.log('='.repeat(75));
  console.log(' AIDRS COMPLETE REDESIGN — BROWSER VISUAL VERIFICATION GATE');
  console.log('='.repeat(75));

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
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text();
      // Ignore favicon or non-critical 404s for optional tiles
      if (!t.includes('favicon.ico')) {
        consoleErrors.push(t);
        console.log(`[CONSOLE ERROR]: ${t}`);
      }
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.toString());
    console.log(`[PAGE ERROR]: ${err.toString()}`);
  });

  const BASE = 'http://localhost:5173';
  const captured = [];

  async function takeScreenshot(name, caption) {
    const filename = `${name}.png`;
    const filePath = path.join(SCREENSHOTS_DIR, filename);
    await page.screenshot({ path: filePath, fullPage: false });
    console.log(`[CAPTURE] Saved: ${filename} — ${caption}`);
    captured.push({ name: filename, caption, path: filePath });
  }

  try {
    // 1. Landing Page (Dark)
    console.log('\n[TEST 1] Landing Page (Dark Mode)...');
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    await takeScreenshot('01_landing_dark', 'AIDRS Landing Page with Hero, Pipeline & Metrics (Dark)');

    // 2. Landing Page (Light Mode)
    console.log('\n[TEST 2] Landing Page (Light Mode via Theme Toggle)...');
    // Click theme toggle button in TopBar
    const themeBtn = await page.$('button[aria-label*="mode"]');
    if (themeBtn) {
      await themeBtn.click();
      await sleep(1500);
      await takeScreenshot('02_landing_light', 'AIDRS Landing Page in Light Mode (Semantic Tokens)');
      // Toggle back to dark mode
      await themeBtn.click();
      await sleep(1000);
    }

    // 3. Scenario Selector
    console.log('\n[TEST 3] Scenario Selector...');
    await page.goto(`${BASE}/scenarios`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    await takeScreenshot('03_scenarios_grid', 'AIDRS Scenario Selector with 2-Column Responsive Cards');

    // 4. Executive Dashboard (Scenario 2: Chamoli)
    console.log('\n[TEST 4] Executive Dashboard (Chamoli)...');
    await page.goto(`${BASE}/scenario/2/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2500);
    await takeScreenshot('04_dashboard_chamoli', 'Executive Situation Dashboard with 6 KPIs & Facilities');

    // 5. Operations Map (Scenario 2: Chamoli 2D)
    console.log('\n[TEST 5] Operations Map (Chamoli 2D)...');
    await page.goto(`${BASE}/scenario/2/map`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3500);
    // Explicitly ensure 2D MAP mode is active
    await page.evaluate(() => {
      if (typeof window.__DRAS_SET_MAP_VIEW_MODE__ === 'function') {
        window.__DRAS_SET_MAP_VIEW_MODE__('2D');
        return true;
      }
      return false;
    });
    await sleep(2500);
    await takeScreenshot('05_map_chamoli_2d', '2D GIS Operations Map with Building Polygons & Controls');

    // 6. Building Inspector Selection
    console.log('\n[TEST 6] Building Inspector Selection...');
    const selectRes = await page.evaluate(() => {
      if (typeof window.__DRAS_SELECT_BUILDING__ === 'function') {
        return window.__DRAS_SELECT_BUILDING__('destroyed');
      }
      return false;
    });
    console.log(`[INFO] Programmatic building selected: ${selectRes}`);
    await sleep(2500);
    await takeScreenshot('06_map_building_inspect', 'Building Inspector with Satellite Pre/Post Crops & 5-Factor Triage');

    // 7. Route Generation
    console.log('\n[TEST 7] Response Route Dispatch...');
    const routeClicked = await page.evaluate(() => {
      if (typeof window.__DRAS_CALCULATE_ROUTE__ === 'function') {
        window.__DRAS_CALCULATE_ROUTE__('RESPONSE');
        return true;
      }
      const btns = Array.from(document.querySelectorAll('button'));
      const rBtn = btns.find(b => b.textContent && b.textContent.includes('RESPONSE ACCESS'));
      if (rBtn) {
        rBtn.click();
        return true;
      }
      return false;
    });
    console.log(`[INFO] Route calculation triggered: ${routeClicked}`);
    await sleep(3500);
    await takeScreenshot('07_map_route_generated', 'Hazard-Aware Authoritative Response Route with Glowing Path');

    // 8. Operations Map Dharali (Scenario 4)
    console.log('\n[TEST 8] Operations Map Dharali (Scenario 4)...');
    await page.goto(`${BASE}/scenario/4/map`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3500);
    await page.evaluate(() => {
      if (typeof window.__DRAS_SET_MAP_VIEW_MODE__ === 'function') {
        window.__DRAS_SET_MAP_VIEW_MODE__('2D');
      }
    });
    await sleep(2000);
    await takeScreenshot('08_map_dharali_overlay', 'Dharali 2025 Zero-Shot Debris Fan Overlay & Sector Prioritisation');

    // 9. Operations Map Cyclone Fani (Scenario 3)
    console.log('\n[TEST 9] Operations Map Cyclone Fani (Scenario 3)...');
    await page.goto(`${BASE}/scenario/3/map`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3500);
    await page.evaluate(() => {
      if (typeof window.__DRAS_SET_MAP_VIEW_MODE__ === 'function') {
        window.__DRAS_SET_MAP_VIEW_MODE__('2D');
      }
    });
    await sleep(2000);
    await takeScreenshot('09_map_fani_points', 'Cyclone Fani EMSR357 Point-Based Damage Grading');

    // 10. Reports View
    console.log('\n[TEST 10] Reports View (Scenario 2)...');
    await page.goto(`${BASE}/scenario/2/reports`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2500);
    await takeScreenshot('10_report_view', 'AIDRS Operations Report with Sector Directives & Export Actions');

    // 11. Research Metrics
    console.log('\n[TEST 11] Research Metrics...');
    await page.goto(`${BASE}/research`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2500);
    await takeScreenshot('11_research_metrics', 'Empirical Research Evaluation Metrics & Confusion Matrix');

    // 12. Model Training V4
    console.log('\n[TEST 12] Model Training V4...');
    await page.goto(`${BASE}/model-training`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2500);
    await takeScreenshot('12_model_training_v4', 'DRAS Model V4 Transfer Learning & Architectural Ablation Suite');

    // 13. System Health
    console.log('\n[TEST 13] System Health...');
    await page.goto(`${BASE}/system`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2500);
    await takeScreenshot('13_system_health', 'System Infrastructure Health with Dynamic Status & Subsystems');

  } catch (err) {
    console.error(`[ERROR IN TEST RUNNER]: ${err.stack || err}`);
  } finally {
    await browser.close();
  }

  console.log('\n' + '='.repeat(75));
  console.log(' AUDIT SUMMARY');
  console.log('='.repeat(75));
  console.log(`Total Screenshots Captured: ${captured.length} / 13`);
  console.log(`Total Page Errors: ${pageErrors.length}`);
  console.log(`Total Browser Console Errors: ${consoleErrors.length}`);

  const report = {
    timestamp: new Date().toISOString(),
    totalScreenshots: captured.length,
    screenshots: captured,
    pageErrors,
    consoleErrors,
    passed: pageErrors.length === 0 && consoleErrors.length === 0 && captured.length === 13
  };

  fs.writeFileSync(
    path.join(SCREENSHOTS_DIR, 'redesign_verification_report.json'),
    JSON.stringify(report, null, 2)
  );

  console.log(`Report saved to: ${path.join(SCREENSHOTS_DIR, 'redesign_verification_report.json')}`);
  console.log(`VERIFICATION STATUS: ${report.passed ? 'PASSED (0 ERRORS)' : 'REVIEW REQUIRED'}`);
  console.log('='.repeat(75));
}

runRedesignVerification().catch(console.error);
