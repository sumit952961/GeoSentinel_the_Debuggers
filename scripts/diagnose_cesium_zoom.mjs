import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('../frontend/node_modules/puppeteer-core');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function diagnose() {
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
  await page.goto('http://127.0.0.1:5173/scenario/1/map', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 4000));

  const diag = await page.evaluate(() => {
    const v = window.__DRAS_CESIUM_VIEWER__;
    if (!v) return { error: 'No __DRAS_CESIUM_VIEWER__' };
    const sscc = v.scene.screenSpaceCameraController;
    const canvas = v.scene.canvas;
    const rect = canvas.getBoundingClientRect();
    const elemAtCenter = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    
    return {
      enableZoom: sscc.enableZoom,
      enableInputs: sscc.enableInputs,
      enableRotate: sscc.enableRotate,
      enableTilt: sscc.enableTilt,
      enableTranslate: sscc.enableTranslate,
      zoomEventTypes: sscc.zoomEventTypes,
      minimumZoomDistance: sscc.minimumZoomDistance,
      maximumZoomDistance: sscc.maximumZoomDistance,
      canvasRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      elemAtCenterTag: elemAtCenter ? elemAtCenter.tagName : null,
      elemAtCenterClass: elemAtCenter ? elemAtCenter.className : null,
      elemAtCenterId: elemAtCenter ? elemAtCenter.id : null,
      canvasPointerEvents: window.getComputedStyle(canvas).pointerEvents,
      containerPointerEvents: window.getComputedStyle(canvas.parentElement).pointerEvents,
      cameraHeight: v.camera.positionCartographic.height
    };
  });

  console.log('CESIUM DIAGNOSTIC:', JSON.stringify(diag, null, 2));

  // Now let's simulate wheel on the canvas directly in evaluate:
  const wheelResult = await page.evaluate(() => {
    const v = window.__DRAS_CESIUM_VIEWER__;
    const canvas = v.scene.canvas;
    const initialHeight = v.camera.positionCartographic.height;

    // Dispatch native wheel event on canvas
    const event = new WheelEvent('wheel', {
      deltaY: 100,
      clientX: window.innerWidth / 2,
      clientY: window.innerHeight / 2,
      bubbles: true,
      cancelable: true
    });
    canvas.dispatchEvent(event);

    return {
      initialHeight,
      dispatched: true
    };
  });
  console.log('Wheel Dispatched:', wheelResult);

  // Wait 500ms and check height
  await new Promise(r => setTimeout(r, 500));
  const heightAfter = await page.evaluate(() => {
    const v = window.__DRAS_CESIUM_VIEWER__;
    return v.camera.positionCartographic.height;
  });
  console.log('Height after evaluate wheel:', heightAfter);

  await browser.close();
}

diagnose().catch(console.error);
