import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('../frontend/node_modules/puppeteer-core');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function testCesiumPolygon() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--enable-webgl', '--window-size=1600,1000'],
    defaultViewport: { width: 1600, height: 1000 }
  });

  try {
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE:', msg.text()));
    await page.goto('http://localhost:5173/map/1', { waitUntil: 'networkidle2', timeout: 35000 });
    await new Promise(r => setTimeout(r, 2000));

    // Switch to 3D
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn3d = btns.find(b => b.textContent && b.textContent.includes('3D Globe'));
      if (btn3d) btn3d.click();
    });
    await new Promise(r => setTimeout(r, 3000));

    const result = await page.evaluate(async () => {
      const v = window.__DRAS_CESIUM_VIEWER__;
      if (!v) return 'No viewer';

      // Test adding an extruded polygon right in front of the camera
      // Camera is around lon -118.725, lat 34.073
      const centerLon = -118.725;
      const centerLat = 34.073;

      // Fly camera directly to the building cluster center!
      v.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(centerLon, centerLat - 0.005, 600),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-45),
          roll: 0
        },
        duration: 0.1
      });

      // Sample terrain elevation at center
      let terrainAlt = 0;
      try {
        const cartos = [Cesium.Cartographic.fromDegrees(centerLon, centerLat)];
        if (v.terrainProvider && !(v.terrainProvider instanceof Cesium.EllipsoidTerrainProvider)) {
          const sampled = await Cesium.sampleTerrainMostDetailed(v.terrainProvider, cartos);
          terrainAlt = sampled[0].height || 0;
        }
      } catch (err) {
        terrainAlt = 0;
      }

      // Add a test building entity
      const d = 0.0003;
      const testPos = Cesium.Cartesian3.fromDegreesArray([
        centerLon - d, centerLat - d,
        centerLon + d, centerLat - d,
        centerLon + d, centerLat + d,
        centerLon - d, centerLat + d
      ]);

      const testEnt = v.entities.add({
        id: 'test-building-extruded',
        name: 'Test 3D Extruded Building',
        polygon: {
          hierarchy: testPos,
          height: terrainAlt,
          extrudedHeight: terrainAlt + 35,
          material: Cesium.Color.RED.withAlpha(0.95),
          outline: true,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 3
        }
      });

      return {
        terrainProvider: v.terrainProvider ? v.terrainProvider.constructor.name : 'none',
        terrainAlt,
        added: !!testEnt
      };
    });

    console.log('Result:', JSON.stringify(result, null, 2));
    await new Promise(r => setTimeout(r, 4000));

    await page.screenshot({ path: 'outputs/test_extrusion.png' });
    console.log('Screenshot saved to outputs/test_extrusion.png');

  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
}

testCesiumPolygon();
