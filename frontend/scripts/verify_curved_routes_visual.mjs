import puppeteer from 'puppeteer-core';
import path from 'path';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.toString()));

  console.log('Navigating to Scenario 2 Operations Map...');
  await page.goto('http://localhost:5173/scenario/2/map', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2500));

  // Click on "03 RESPOND" tab in the left sidebar
  console.log('Clicking 03 RESPOND tab...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const respondBtn = buttons.find(b => b.textContent.includes('03') || b.textContent.includes('RESPOND'));
    if (respondBtn) respondBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Select a priority building via the UI or map click
  console.log('Selecting priority structure from sidebar or map...');
  const selectedBuildingId = await page.evaluate(() => {
    // If there is a sector list, click on the critical sector
    const sectors = Array.from(document.querySelectorAll('*'));
    const critSector = sectors.find(el => el.textContent && el.textContent.includes('Raini Ground Zero'));
    if (critSector) critSector.click();
    return true;
  });
  await new Promise(r => setTimeout(r, 1500));

  // Click a building polygon on map
  await page.evaluate(() => {
    const paths = Array.from(document.querySelectorAll('path.leaflet-interactive'));
    if (paths.length > 5) {
      // Click one of the middle paths
      paths[Math.floor(paths.length / 2)].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 1500));

  // Click "Calculate Response Route" button
  console.log('Clicking Calculate Response Route button...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const calcBtn = buttons.find(b => 
      b.textContent.includes('Calculate') || 
      b.textContent.includes('Route') ||
      b.textContent.includes('Generate')
    );
    if (calcBtn) calcBtn.click();
  });
  await new Promise(r => setTimeout(r, 4000));

  await page.screenshot({ path: '../outputs/scenario2_curved_route_verified.png' });
  console.log('Saved scenario2_curved_route_verified.png');

  // Check if route rendered
  const routeRendered = await page.evaluate(() => {
    const paths = Array.from(document.querySelectorAll('path'));
    return paths.some(p => p.getAttribute('stroke') === '#d97706' || p.getAttribute('stroke') === '#f59e0b' || p.getAttribute('stroke-width') === '6');
  });
  console.log('Route SVG rendered on map:', routeRendered);
  console.log('Errors:', errors);

  await browser.close();
}

main().catch(console.error);
