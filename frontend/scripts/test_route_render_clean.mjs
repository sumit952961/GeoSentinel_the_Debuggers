import puppeteer from 'puppeteer-core';

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
  await new Promise(r => setTimeout(r, 2000));

  // Select a building directly by picking from rawDataRef or clicking a circleMarker
  console.log('Selecting building in Raini Ground Zero...');
  const selected = await page.evaluate(() => {
    // Click on circleMarker or path representing a building
    const markers = Array.from(document.querySelectorAll('.leaflet-interactive'));
    // Find building markers (circle markers or building paths)
    const bldg = markers.find(m => m.tagName.toLowerCase() === 'path' && m.getAttribute('fill') && m.getAttribute('fill') !== 'none');
    if (bldg) {
      bldg.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    }
    return false;
  });
  console.log('Building selected on map:', selected);
  await new Promise(r => setTimeout(r, 1000));

  // Switch to RESPOND tab
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(btn => btn.textContent.includes('RESPOND'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 800));

  // Click Calculate Response Route
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(btn => btn.textContent.includes('Calculate') || btn.textContent.includes('Generate') || btn.textContent.includes('Route'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 3000));

  await page.screenshot({ path: '../outputs/scenario2_curved_route_clean.png' });
  console.log('Saved scenario2_curved_route_clean.png');

  const routeGeo = await page.evaluate(() => {
    const paths = Array.from(document.querySelectorAll('path'));
    const rPath = paths.find(p => p.getAttribute('stroke') === '#d97706');
    return rPath ? rPath.getAttribute('d') : null;
  });
  console.log('Route path data found:', !!routeGeo);
  if (routeGeo) {
    console.log('Route path coordinate segments count:', routeGeo.split('L').length);
  }
  console.log('Errors:', errors);

  await browser.close();
}

main().catch(console.error);
