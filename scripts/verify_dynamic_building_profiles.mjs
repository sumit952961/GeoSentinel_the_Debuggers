import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const require = createRequire(import.meta.url);
const puppeteer = require('../frontend/node_modules/puppeteer-core');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyProfiles() {
  console.log('='.repeat(70));
  console.log(' VERIFYING DYNAMIC FORENSIC STRUCTURAL PROFILES ACROSS BUILDINGS');
  console.log('='.repeat(70));

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--window-size=1600,1050'
    ],
    defaultViewport: { width: 1600, height: 1050 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:5173/map/1', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(3500);

  // Test buildings: #236 (user screenshot), #1, #6, #12
  const testIds = [236, 1, 6, 12];
  const profiles = [];

  for (const bId of testIds) {
    const selected = await page.evaluate((id) => {
      if (typeof window.__DRAS_SELECT_BUILDING__ === 'function') {
        return window.__DRAS_SELECT_BUILDING__(id);
      }
      return false;
    }, bId);

    if (!selected) {
      console.error(`Failed to select building #${bId}`);
      continue;
    }

    await sleep(700);

    const data = await page.evaluate(() => {
      const col = document.querySelector('div[style*="width: 360px"]');
      if (!col) return null;
      return {
        text: col.innerText
      };
    });

    if (data) {
      console.log(`\n--- Extracted Data for Building #${bId} ---`);
      const text = data.text;
      
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      
      const getLineAfter = (label) => {
        const idx = lines.findIndex(l => l.toLowerCase().includes(label.toLowerCase()));
        return idx !== -1 && idx + 1 < lines.length ? lines[idx + 1] : 'NOT FOUND';
      };

      const archetype = getLineAfter('Structural Archetype:');
      const gnss = getLineAfter('GNSS Sub-Meter GPS:');
      const roof = getLineAfter('1. Roof & Envelope System:');
      const wall = getLineAfter('2. Load-Bearing Frame / Walls:');
      const foundation = getLineAfter('3. Geotechnical Foundation:');
      const hazard = getLineAfter('4. Hazard Corridor Impact:');
      const directiveHeader = getLineAfter('TACTICAL USAR DIRECTIVE');
      const directiveAction = getLineAfter(directiveHeader);

      const profile = {
        bId,
        archetype,
        gnss,
        roof,
        wall,
        foundation,
        hazard,
        directiveHeader,
        directiveAction
      };

      console.log('Archetype:', profile.archetype);
      console.log('GNSS:', profile.gnss);
      console.log('Roof Status:', profile.roof);
      console.log('Wall Status:', profile.wall);
      console.log('Foundation Status:', profile.foundation);
      console.log('Hazard Status:', profile.hazard);
      console.log('Directive:', profile.directiveHeader);

      profiles.push(profile);
    }
  }

  // Screenshot of structure #236 (matching user view)
  await page.evaluate(() => {
    if (typeof window.__DRAS_SELECT_BUILDING__ === 'function') {
      window.__DRAS_SELECT_BUILDING__(236);
    }
  });
  await sleep(600);

  const outDir = path.join(__dirname, '..', 'outputs');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const screenshotPath = path.join(outDir, 'building_profile_236_verified.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`\nScreenshot saved to: ${screenshotPath}`);

  // Also select building #1 and take screenshot to compare
  await page.evaluate(() => {
    if (typeof window.__DRAS_SELECT_BUILDING__ === 'function') {
      window.__DRAS_SELECT_BUILDING__(1);
    }
  });
  await sleep(600);
  const screenshot1Path = path.join(outDir, 'building_profile_1_verified.png');
  await page.screenshot({ path: screenshot1Path, fullPage: false });
  console.log(`Screenshot saved to: ${screenshot1Path}`);

  await browser.close();

  // Verification checks
  console.log('\n' + '='.repeat(70));
  console.log(' COMPARATIVE PROFILE DIVERSITY VALIDATION');
  console.log('='.repeat(70));

  let allChecksPassed = true;

  // Check 1: GNSS formatting uses 'W' instead of '-... E'
  for (const p of profiles) {
    if (p.gnss.includes('° E') || p.gnss.includes('-%')) {
      console.error(`FAIL: Profile #${p.bId} contains invalid East or negative coordinate: ${p.gnss}`);
      allChecksPassed = false;
    } else if (p.gnss.includes('° W')) {
      console.log(`PASS: Profile #${p.bId} GNSS correctly formatted with West hemisphere: ${p.gnss}`);
    } else {
      console.error(`FAIL: Profile #${p.bId} GNSS missing or invalid: ${p.gnss}`);
      allChecksPassed = false;
    }
  }

  // Check 2: Distinct diagnostics across buildings
  const roofDiagnostics = new Set(profiles.map(p => p.roof));
  const archetypes = new Set(profiles.map(p => p.archetype));
  const tacticalDirectives = new Set(profiles.map(p => p.directiveHeader));

  console.log(`Unique archetypes found: ${archetypes.size} / ${profiles.length}`);
  console.log(`Unique roof diagnostics found: ${roofDiagnostics.size} / ${profiles.length}`);
  console.log(`Unique tactical directives found: ${tacticalDirectives.size} / ${profiles.length}`);

  if (roofDiagnostics.size > 1 && archetypes.size > 1 && tacticalDirectives.size > 1) {
    console.log('PASS: Profiles are dynamically diversified per building ID!');
  } else {
    console.error('FAIL: Profiles are still identical or insufficiently diversified!');
    allChecksPassed = false;
  }

  if (allChecksPassed) {
    console.log('\n>>> ALL FORENSIC PROFILE DIVERSITY CHECKS PASSED SUCCESSFULLY! <<<');
  } else {
    process.exit(1);
  }
}

verifyProfiles().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
