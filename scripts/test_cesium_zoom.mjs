import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('../frontend/node_modules/puppeteer-core');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function testCesiumZoom() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-web-security', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5173/scenario/1/map', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 4500));

  // Move mouse over canvas and zoom in
  const canvas = await page.$('.cesium-widget-canvas');
  if (canvas) {
    const box = await canvas.boundingBox();
    console.log('Canvas bounding box:', box);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);

    // Zoom in deeply
    for (let i = 0; i < 18; i++) {
      await page.mouse.wheel({ deltaY: -250 });
      await new Promise(r => setTimeout(r, 80));
    }
    await new Promise(r => setTimeout(r, 2000));

    // Tilt camera by holding right-click and dragging up
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(cx, cy - 200, { steps: 20 });
    await page.mouse.up({ button: 'right' });
    await new Promise(r => setTimeout(r, 2000));
  }

  await page.screenshot({ path: './outputs/temp_cesium_zoomed.jpg', type: 'jpeg', quality: 95 });
  await browser.close();
  console.log('Saved temp_cesium_zoomed.jpg');
}

testCesiumZoom().catch(console.error);
