import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const puppeteer = require('../frontend/node_modules/puppeteer-core');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyBuildingInteractivityAndHierarchy() {
  console.log('='.repeat(70));
  console.log(' VERIFYING NO FLOATING BOX, CLICKABLE BUILDINGS & 4-TIER ZONE HIERARCHY');
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
    console.log('1. Navigating to California Scenario Map: http://localhost:5173/scenario/1/map');
    await page.goto('http://localhost:5173/scenario/1/map', { waitUntil: 'networkidle2', timeout: 35000 });
    await sleep(4000);

    // Check Sector Cards in Right Panel
    console.log('2. Inspecting Operational Sectors & Criticality Badges...');
    const sectorHierarchy = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.sector-card-item'));
      return cards.map(c => {
        const nameEl = c.querySelector('div > div:first-child');
        const badgeEl = c.querySelector('span');
        return {
          name: nameEl ? nameEl.innerText.trim() : '',
          criticality: badgeEl ? badgeEl.innerText.trim() : ''
        };
      });
    });
    console.log('Operational Sector Badges detected:', JSON.stringify(sectorHierarchy, null, 2));

    const lowSectors = sectorHierarchy.filter(s => s.criticality === 'LOW');
    const medSectors = sectorHierarchy.filter(s => s.criticality === 'MEDIUM');
    const highSectors = sectorHierarchy.filter(s => s.criticality === 'HIGH');
    const critSectors = sectorHierarchy.filter(s => s.criticality === 'CRITICAL');

    console.log(`Summary: LOW=${lowSectors.length}, MEDIUM=${medSectors.length}, HIGH=${highSectors.length}, CRITICAL=${critSectors.length}`);

    // Check Leaflet Panes
    console.log('3. Inspecting Leaflet Panes & Stacking Order...');
    const panesInfo = await page.evaluate(() => {
      const zp = document.querySelector('.leaflet-pane.leaflet-zonesPane-pane');
      const bp = document.querySelector('.leaflet-pane.leaflet-buildingsPane-pane');
      return {
        zonesPaneZIndex: zp ? zp.style.zIndex : null,
        buildingsPaneZIndex: bp ? bp.style.zIndex : null,
        zonesElementsCount: zp ? zp.querySelectorAll('path').length : 0,
        buildingsElementsCount: bp ? bp.querySelectorAll('path, circle').length : 0
      };
    });
    console.log('Leaflet Panes Info:', JSON.stringify(panesInfo, null, 2));

    // Hover over the center of the map to verify no floating cursor box blocks the view
    console.log('4. Testing Cursor Hover across Operational Zone...');
    await page.mouse.move(700, 450);
    await sleep(600);
    await page.mouse.move(750, 480);
    await sleep(600);

    const tooltipCheck = await page.evaluate(() => {
      const tooltips = Array.from(document.querySelectorAll('.leaflet-tooltip'));
      return tooltips.map(t => ({
        text: t.innerText.replace(/\s+/g, ' ').trim(),
        pointerEvents: window.getComputedStyle(t).pointerEvents
      }));
    });
    console.log('Active Tooltips during hover:', JSON.stringify(tooltipCheck, null, 2));

    // Click on a building marker inside buildingsPane
    console.log('5. Clicking on a Building Marker to verify direct responsiveness...');
    const clickSuccess = await page.evaluate(() => {
      const bp = document.querySelector('.leaflet-pane.leaflet-buildingsPane-pane');
      if (!bp) return { success: false, reason: 'buildingsPane not found' };
      const buildingMarkers = Array.from(bp.querySelectorAll('path.leaflet-interactive, circle.leaflet-interactive'));
      if (buildingMarkers.length === 0) return { success: false, reason: 'no building markers in buildingsPane' };

      // Find a marker that is visible (has bounding rect)
      for (const m of buildingMarkers) {
        const rect = m.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.top > 100 && rect.left > 100) {
          m.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          return { success: true, markerTag: m.tagName, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
      }
      return { success: false, reason: 'no visible marker found' };
    });
    console.log('Marker click dispatched:', JSON.stringify(clickSuccess, null, 2));
    await sleep(1500);

    // Verify Inspector / Selected Building State
    console.log('6. Inspecting Building Detail Panel...');
    const inspectorDetails = await page.evaluate(() => {
      // Look for structure header or damage badge in right panel
      const text = document.body.innerText;
      const hasStructureDetail = text.includes('STRUCTURE') || text.includes('DAMAGE SEVERITY') || text.includes('Structure #') || text.includes('Confidence');
      const buildingInspectorPanel = document.querySelector('[data-testid="building-inspector"], .building-detail-panel, #building-detail-card') || null;
      return {
        hasStructureDetail,
        panelFound: !!buildingInspectorPanel,
        selectedBuildingHeading: document.querySelector('h2, h3, h4, strong')?.innerText
      };
    });
    console.log('Inspector state:', JSON.stringify(inspectorDetails, null, 2));

    // Capture screenshot
    if (!fs.existsSync('outputs')) fs.mkdirSync('outputs', { recursive: true });
    const screenshotPath = path.resolve('outputs/map_2d_no_floating_box_clickable.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Saved screenshot to: ${screenshotPath}`);

    // Copy to artifact directory
    const artifactDir = 'C:\\Users\\sumit\\.gemini\\antigravity-ide\\brain\\3a3e6fc2-fac9-4466-83b9-7f08c458c27a';
    if (fs.existsSync(artifactDir)) {
      fs.copyFileSync(screenshotPath, path.join(artifactDir, 'map_2d_no_floating_box_clickable.png'));
      console.log('Copied screenshot to artifacts directory');
    }

  } catch (err) {
    console.error('Verification failed with error:', err);
  } finally {
    await browser.close();
  }
}

verifyBuildingInteractivityAndHierarchy();
