import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const puppeteer = require('../frontend/node_modules/puppeteer-core');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verify3DBuildings() {
  console.log('='.repeat(70));
  console.log(' VERIFYING 3D GLOBE CLEAN BUILDINGS (NO DOT CLUTTER)');
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
      '--window-size=1600,1000'
    ],
    defaultViewport: { width: 1600, height: 1000 }
  });

  try {
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    console.log('Navigating to http://localhost:5173/map/1 ...');
    await page.goto('http://localhost:5173/map/1', { waitUntil: 'networkidle2', timeout: 35000 });
    await sleep(2000);

    // Click 3D Globe button
    console.log('Switching to 3D Globe view...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn3d = btns.find(b => b.textContent && b.textContent.includes('3D Globe'));
      if (btn3d) btn3d.click();
    });
    // Wait for flyTo transition and Cesium render
    await sleep(6000);

    const shot1 = path.resolve('outputs/3d_buildings_overview.png');
    await page.screenshot({ path: shot1 });
    console.log('Saved 3D overview screenshot to:', shot1);

    // Inspect entity types in dras-buildings
    const stats = await page.evaluate(() => {
      const v = window.__DRAS_CESIUM_VIEWER__;
      if (!v) return { error: 'No viewer' };

      let bldgDs = null;
      for (let i = 0; i < v.dataSources.length; i++) {
        if (v.dataSources.get(i).name === 'dras-buildings') {
          bldgDs = v.dataSources.get(i);
        }
      }
      if (!bldgDs) return { error: 'No dras-buildings datasource' };

      const typeCounts = { polygon: 0, polyline: 0, point: 0, other: 0 };
      bldgDs.entities.values.forEach(e => {
        if (e.polygon) typeCounts.polygon++;
        else if (e.polyline) typeCounts.polyline++;
        else if (e.point) typeCounts.point++;
        else typeCounts.other++;
      });

      return {
        totalEntities: bldgDs.entities.values.length,
        typeCounts
      };
    });

    console.log('Building Entity Stats:', JSON.stringify(stats, null, 2));

    // Now test clicking on a building to verify single-target highlight
    console.log('Clicking on first building in right panel or picking in Cesium...');
    await page.evaluate(() => {
      const v = window.__DRAS_CESIUM_VIEWER__;
      if (!v) return;
      const bldgDs = v.dataSources.get(3); // dras-buildings
      if (bldgDs && bldgDs.entities.values.length > 0) {
        const firstPoly = bldgDs.entities.values.find(e => e.polygon);
        if (firstPoly) {
          v.selectedEntity = firstPoly;
        }
      }
    });
    await sleep(2000);

    const shot2 = path.resolve('outputs/3d_building_selected.png');
    await page.screenshot({ path: shot2 });
    console.log('Saved 3D selected building screenshot to:', shot2);

  } catch (e) {
    console.error('Error during verification:', e);
  } finally {
    await browser.close();
  }
}

verify3DBuildings();
