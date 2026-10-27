import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('../frontend/node_modules/puppeteer-core');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function testDualScenario() {
  console.log('Testing Dual Scenario Flow (3D Wildfire + 2D Chamoli Flood)...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-web-security', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();

  // -------------------------------------------------------------
  // PART 1: 3D Wildfire (Scenario 1)
  // -------------------------------------------------------------
  console.log('1. Loading Scenario 1 (Wildfire) in 3D Cesium...');
  await page.goto('http://localhost:5173/scenario/1/map', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 4000));

  // High Orbit overview
  await page.screenshot({ path: './outputs/dual_1_wildfire_3d_high_orbit.jpg', type: 'jpeg', quality: 90 });
  console.log('Saved dual_1_wildfire_3d_high_orbit.jpg');

  // Programmatic camera fly-in to mountain canyon with 3D buildings
  console.log('Flying camera to mountain canyon buildings...');
  await page.evaluate(() => {
    if (window.__DRAS_CESIUM_VIEWER__ && window.Cesium) {
      const viewer = window.__DRAS_CESIUM_VIEWER__;
      const Cesium = window.Cesium;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-118.7245, 34.0720, 320),
        orientation: {
          heading: Cesium.Math.toRadians(25.0),
          pitch: Cesium.Math.toRadians(-28.0),
          roll: 0.0
        },
        duration: 1.5
      });
    }
  });
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: './outputs/dual_2_wildfire_3d_canyon_zoom.jpg', type: 'jpeg', quality: 90 });
  console.log('Saved dual_2_wildfire_3d_canyon_zoom.jpg');

  // Even deeper zoom right over the 3D building rooftops!
  console.log('Deep zooming right above 3D building cluster...');
  await page.evaluate(() => {
    if (window.__DRAS_CESIUM_VIEWER__ && window.Cesium) {
      const viewer = window.__DRAS_CESIUM_VIEWER__;
      const Cesium = window.Cesium;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-118.7242, 34.0728, 140),
        orientation: {
          heading: Cesium.Math.toRadians(45.0),
          pitch: Cesium.Math.toRadians(-22.0),
          roll: 0.0
        },
        duration: 1.2
      });
    }
  });
  await new Promise(r => setTimeout(r, 2200));

  // Select building to open the Inspector
  await page.evaluate(() => {
    if (window.__DRAS_SELECT_BUILDING__) {
      window.__DRAS_SELECT_BUILDING__('destroyed');
    }
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: './outputs/dual_3_wildfire_3d_building_rooftops.jpg', type: 'jpeg', quality: 90 });
  console.log('Saved dual_3_wildfire_3d_building_rooftops.jpg');

  // -------------------------------------------------------------
  // PART 2: 2D Chamoli Flash Flood (Scenario 2)
  // -------------------------------------------------------------
  console.log('2. Loading Scenario 2 (Chamoli Flash Flood) in 2D...');
  await page.goto('http://localhost:5173/scenario/2/map', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2500));

  // Switch to 2D View
  await page.evaluate(() => {
    if (window.__DRAS_SET_MAP_VIEW_MODE__) {
      window.__DRAS_SET_MAP_VIEW_MODE__('2D');
    }
  });
  await new Promise(r => setTimeout(r, 1500));

  // Center on Chamoli buildings at high zoom
  await page.evaluate(() => {
    if (window.__DRAS_MAP__) {
      window.__DRAS_MAP__.setView([30.4404, 79.6197], 16, { animate: false });
    }
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: './outputs/dual_4_chamoli_2d_overview.jpg', type: 'jpeg', quality: 90 });
  console.log('Saved dual_4_chamoli_2d_overview.jpg');

  // Deep zoom on Chamoli riverbed structures
  console.log('Deep zooming on riverbed structures in Chamoli...');
  await page.evaluate(() => {
    if (window.__DRAS_MAP__) {
      window.__DRAS_MAP__.setView([30.4404, 79.6197], 17, { animate: true });
    }
  });
  await new Promise(r => setTimeout(r, 1200));

  // Select destroyed building in Chamoli
  await page.evaluate(() => {
    if (window.__DRAS_SELECT_BUILDING__) {
      window.__DRAS_SELECT_BUILDING__('destroyed');
    }
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: './outputs/dual_5_chamoli_building_inspector.jpg', type: 'jpeg', quality: 90 });
  console.log('Saved dual_5_chamoli_building_inspector.jpg');

  // Calculate Response Route in Chamoli
  console.log('Calculating Response Route in Chamoli...');
  await page.evaluate(() => {
    if (window.__DRAS_CALCULATE_ROUTE__) {
      window.__DRAS_CALCULATE_ROUTE__('RESPONSE');
    }
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: './outputs/dual_6_chamoli_response_route.jpg', type: 'jpeg', quality: 90 });
  console.log('Saved dual_6_chamoli_response_route.jpg');

  // Calculate Evacuation Route in Chamoli
  console.log('Calculating Evacuation Route in Chamoli...');
  await page.evaluate(() => {
    if (window.__DRAS_CALCULATE_ROUTE__) {
      window.__DRAS_CALCULATE_ROUTE__('EVACUATION', 'hospital');
    }
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: './outputs/dual_7_chamoli_evacuation_route.jpg', type: 'jpeg', quality: 90 });
  console.log('Saved dual_7_chamoli_evacuation_route.jpg');

  await browser.close();
  console.log('Testing completed successfully!');
}

testDualScenario().catch(console.error);
