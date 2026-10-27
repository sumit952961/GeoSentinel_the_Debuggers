import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const puppeteer = require('../frontend/node_modules/puppeteer-core');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyCaliforniaMap() {
  console.log('='.repeat(70));
  console.log(' VERIFYING CALIFORNIA SCENARIO 2D MAP BUILDING DIVERSE COLORS');
  console.log('='.repeat(70));

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--window-size=1600,1000'
    ],
    defaultViewport: { width: 1600, height: 1000 }
  });

  try {
    const page = await browser.newPage();
    console.log('Navigating to California 2D Map: http://localhost:5173/map/1');
    await page.goto('http://localhost:5173/map/1', { waitUntil: 'networkidle2', timeout: 35000 });
    await sleep(4000);

    const screenshotPath = path.resolve('outputs/map_2d_california_diverse_colors.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Saved screenshot to: ${screenshotPath}`);

    // Inspect colors of building SVG paths / circles on the map
    const buildingColorStats = await page.evaluate(() => {
      const paths = Array.from(document.querySelectorAll('svg path.leaflet-interactive, svg circle.leaflet-interactive, path, circle'));
      const fillCounts = {};
      paths.forEach(el => {
        const fill = el.getAttribute('fill') || el.style.fill;
        if (fill) {
          fillCounts[fill] = (fillCounts[fill] || 0) + 1;
        }
      });
      return fillCounts;
    });

    console.log('SVG Element Fill Stats on 2D map:', JSON.stringify(buildingColorStats, null, 2));
  } catch (err) {
    console.error('Error verifying California 2D Map:', err);
  } finally {
    await browser.close();
  }
}

verifyCaliforniaMap();
