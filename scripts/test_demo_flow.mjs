import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('../frontend/node_modules/puppeteer-core');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function testDemoFlow() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-web-security', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  
  console.log('1. Loading Scenario 1 Map...');
  await page.goto('http://localhost:5173/scenario/1/map', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  console.log('2. Switching to 2D Map mode...');
  await page.evaluate(() => {
    if (typeof window.__DRAS_SET_MAP_VIEW_MODE__ === 'function') {
      window.__DRAS_SET_MAP_VIEW_MODE__('2D');
    }
  });
  await new Promise(r => setTimeout(r, 2000));

  console.log('3. Selecting a high priority destroyed building...');
  const selectRes = await page.evaluate(() => {
    if (typeof window.__DRAS_SELECT_BUILDING__ === 'function') {
      return window.__DRAS_SELECT_BUILDING__('destroyed');
    }
    return false;
  });
  console.log('Selected building result:', selectRes);
  await new Promise(r => setTimeout(r, 2000));

  console.log('4. Calculating RESPONSE route...');
  const respRouteRes = await page.evaluate(() => {
    if (typeof window.__DRAS_CALCULATE_ROUTE__ === 'function') {
      window.__DRAS_CALCULATE_ROUTE__('RESPONSE');
      return true;
    }
    return false;
  });
  console.log('Response route trigger:', respRouteRes);
  await new Promise(r => setTimeout(r, 3000));

  console.log('5. Calculating EVACUATION route...');
  const evacRouteRes = await page.evaluate(() => {
    if (typeof window.__DRAS_CALCULATE_ROUTE__ === 'function') {
      window.__DRAS_CALCULATE_ROUTE__('EVACUATION', 'hospital');
      return true;
    }
    return false;
  });
  console.log('Evacuation route trigger:', evacRouteRes);
  await new Promise(r => setTimeout(r, 3000));

  await browser.close();
  console.log('Demo flow test completed successfully!');
}

testDemoFlow().catch(console.error);
