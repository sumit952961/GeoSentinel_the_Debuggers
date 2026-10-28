import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('../frontend/node_modules/puppeteer-core');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function debugEntities() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--enable-webgl', '--window-size=1600,1000'],
    defaultViewport: { width: 1600, height: 1000 }
  });

  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:5173/map/1', { waitUntil: 'networkidle2', timeout: 35000 });
    await sleep(2000);

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn3d = btns.find(b => b.textContent && b.textContent.includes('3D Globe'));
      if (btn3d) btn3d.click();
    });
    await sleep(4000);

    const info = await page.evaluate(() => {
      const v = window.__DRAS_CESIUM_VIEWER__;
      if (!v) return 'No viewer';

      const carto = Cesium.Cartographic.fromCartesian(v.camera.position);
      const cam = {
        lon: Cesium.Math.toDegrees(carto.longitude),
        lat: Cesium.Math.toDegrees(carto.latitude),
        height: carto.height,
        pitch: Cesium.Math.toDegrees(v.camera.pitch),
        heading: Cesium.Math.toDegrees(v.camera.heading)
      };

      const dsList = v.dataSources;
      let bldgDs = null;
      for (let i = 0; i < dsList.length; i++) {
        if (dsList.get(i).name === 'dras-buildings') bldgDs = dsList.get(i);
      }

      if (!bldgDs) return { cam, err: 'No dras-buildings ds' };

      const sampleEntities = [];
      const ents = bldgDs.entities.values;
      for (let i = 0; i < Math.min(10, ents.length); i++) {
        const e = ents[i];
        const entInfo = { id: e.id, name: e.name, show: e.show };
        if (e.polygon) {
          entInfo.type = 'polygon';
          entInfo.height = e.polygon.height ? e.polygon.height.getValue() : null;
          entInfo.extrudedHeight = e.polygon.extrudedHeight ? e.polygon.extrudedHeight.getValue() : null;
          entInfo.heightReference = e.polygon.heightReference ? e.polygon.heightReference.getValue() : null;
          entInfo.extrudedHeightReference = e.polygon.extrudedHeightReference ? e.polygon.extrudedHeightReference.getValue() : null;
          const hier = e.polygon.hierarchy ? e.polygon.hierarchy.getValue() : null;
          if (hier && hier.positions && hier.positions.length > 0) {
            const p0 = Cesium.Cartographic.fromCartesian(hier.positions[0]);
            entInfo.p0 = {
              lon: Cesium.Math.toDegrees(p0.longitude),
              lat: Cesium.Math.toDegrees(p0.latitude),
              height: p0.height
            };
          }
        } else if (e.point) {
          entInfo.type = 'point';
          entInfo.pixelSize = e.point.pixelSize ? e.point.pixelSize.getValue() : null;
          entInfo.distanceDisplayCondition = e.point.distanceDisplayCondition ? e.point.distanceDisplayCondition.getValue() : null;
          if (e.position) {
            const pos = Cesium.Cartographic.fromCartesian(e.position.getValue());
            entInfo.pos = {
              lon: Cesium.Math.toDegrees(pos.longitude),
              lat: Cesium.Math.toDegrees(pos.latitude),
              height: pos.height
            };
          }
        }
        sampleEntities.push(entInfo);
      }

      // Check terrain elevation at first building position
      let terrainSample = null;
      if (sampleEntities[0] && sampleEntities[0].p0) {
        terrainSample = sampleEntities[0].p0;
      }

      return { cam, terrainSample, sampleEntities };
    });

    console.log(JSON.stringify(info, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
}

debugEntities();
