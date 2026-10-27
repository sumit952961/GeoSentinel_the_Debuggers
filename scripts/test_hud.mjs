import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('../frontend/node_modules/puppeteer-core');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function testHUD() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-web-security', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:5173/scenario/1/map', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));

  await page.evaluate(() => {
    if (window.__DRAS_SET_MAP_VIEW_MODE__) window.__DRAS_SET_MAP_VIEW_MODE__('2D');
  });
  await new Promise(r => setTimeout(r, 1500));

  // Select a destroyed building
  await page.evaluate(() => {
    if (window.__DRAS_SELECT_BUILDING__) window.__DRAS_SELECT_BUILDING__('destroyed');
  });
  await new Promise(r => setTimeout(r, 1000));

  // Inject sleek HUD overlay
  await page.evaluate(() => {
    const hud = document.createElement('div');
    hud.id = 'demo-hud-overlay';
    hud.innerHTML = `
      <div style="
        position: fixed;
        bottom: 24px;
        left: 24px;
        z-index: 99999;
        display: flex;
        align-items: center;
        gap: 16px;
        background: rgba(15, 23, 42, 0.92);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(56, 189, 248, 0.35);
        border-left: 4px solid #0284c7;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 12px 36px rgba(0,0,0,0.6);
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="background: rgba(2, 132, 199, 0.2); border: 1px solid #0284c7; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; color: #38bdf8;">
          PHASE 02: PRIORITISE
        </div>
        <div>
          <div style="font-size: 14px; font-weight: 700; color: #f8fafc; letter-spacing: -0.01em;">
            Explainable Multi-Factor Triage Scoring
          </div>
          <div style="font-size: 11px; color: #94a3b8; font-family: monospace; margin-top: 2px;">
            Formula: Priority = 0.40·Severity + 0.25·Population + 0.20·Infrastructure + 0.15·Accessibility
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(hud);
  });

  const outDir = './outputs/temp_test_hud';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({ path: `${outDir}/hud_sample.jpg`, type: 'jpeg', quality: 95 });

  await browser.close();
  console.log('HUD test screenshot saved to outputs/temp_test_hud/hud_sample.jpg');
}

testHUD().catch(console.error);
