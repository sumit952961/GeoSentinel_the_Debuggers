import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const puppeteer = require('../frontend/node_modules/puppeteer-core');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function testBuildingClick() {
  console.log('='.repeat(70));
  console.log(' TESTING DIRECT CLICK ON BUILDING MARKER');
  console.log('='.repeat(70));

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,1000'],
    defaultViewport: { width: 1600, height: 1000 }
  });

  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:5173/scenario/1/map', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 4000));

    // Get building markers inside the buildings pane
    const clickResult = await page.evaluate(() => {
      const bPane = document.querySelector('.leaflet-pane.leaflet-buildings-pane');
      if (!bPane) return { error: 'buildings-pane not found' };

      const markers = Array.from(bPane.querySelectorAll('path.leaflet-interactive, circle.leaflet-interactive'));
      if (markers.length === 0) return { error: 'no interactive markers in buildings-pane' };

      // Pick marker #10
      const targetMarker = markers[10] || markers[0];
      const rect = targetMarker.getBoundingClientRect();

      // Dispatch real click
      targetMarker.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

      return {
        totalMarkers: markers.length,
        clickedTag: targetMarker.tagName,
        coords: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      };
    });

    console.log('Click result:', JSON.stringify(clickResult, null, 2));
    await new Promise(r => setTimeout(r, 2000));

    // Check if right sidebar updated with building inspector
    const inspectorInfo = await page.evaluate(() => {
      const rightSidebarText = document.querySelector('aside, .sidebar, div[style*="overflow-y: auto"]')?.innerText || document.body.innerText;
      return {
        hasStructureTitle: rightSidebarText.includes('STRUCTURE #') || rightSidebarText.includes('Structure #') || rightSidebarText.includes('STRUCTURE PROFILE'),
        hasDamageClass: rightSidebarText.includes('DESTROYED') || rightSidebarText.includes('MAJOR DAMAGE') || rightSidebarText.includes('MINOR DAMAGE') || rightSidebarText.includes('NO DAMAGE') || rightSidebarText.includes('Damage Severity'),
        hasAtcPlacard: rightSidebarText.includes('ATC-20') || rightSidebarText.includes('UNSAFE') || rightSidebarText.includes('RESTRICTED USE') || rightSidebarText.includes('INSPECTED')
      };
    });

    console.log('Inspector Info after click:', JSON.stringify(inspectorInfo, null, 2));

    const screenshotPath = path.resolve('outputs/building_clicked_inspector_verified.png');
    await page.screenshot({ path: screenshotPath });
    console.log('Saved screenshot to:', screenshotPath);

    const artifactDir = 'C:\\Users\\sumit\\.gemini\\antigravity-ide\\brain\\3a3e6fc2-fac9-4466-83b9-7f08c458c27a';
    const fs = require('fs');
    if (fs.existsSync(artifactDir)) {
      fs.copyFileSync(screenshotPath, path.join(artifactDir, 'building_clicked_inspector_verified.png'));
      console.log('Copied to artifacts directory!');
    }
  } finally {
    await browser.close();
  }
}

testBuildingClick();
