import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const puppeteer = require('../frontend/node_modules/puppeteer-core');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testBuildingInteractions() {
  console.log('='.repeat(70));
  console.log(' DRAS 10-BUILDING INTERACTION AUDIT (ZERO "NO DATA AVAILABLE")');
  console.log('='.repeat(70));

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--use-gl=angle',
      '--use-angle=d3d11',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--window-size=1600,1000'
    ],
    defaultViewport: { width: 1600, height: 1000 }
  });

  const page = await browser.newPage();
  let totalTested = 0;
  let passedInteractions = 0;
  let failures = [];

  for (const sid of [2, 3, 4, 1]) {
    console.log(`\n--- Auditing Scenario #${sid} ---`);
    await page.goto(`http://localhost:5173/map/${sid}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);

    // Retrieve building IDs directly from the backend via Node fetch
    let buildingList = [];
    try {
      const res = await fetch(`http://localhost:8081/api/map/damages/${sid}`);
      const data = await res.json();
      buildingList = (data.features || []).slice(0, 10).map(f => ({
        id: f.properties?.buildingId || f.properties?.id,
        damageClass: f.properties?.damageClass,
        confidence: f.properties?.confidence
      }));
    } catch (e) {
      console.error(`  Failed to fetch building list from backend for scenario ${sid}:`, e.message);
    }

    console.log(`  Targeting ${buildingList.length} verified buildings in Scenario #${sid}:`, buildingList.map(b => `#${b.id}`).join(', '));

    for (const b of buildingList) {
      totalTested++;

      // Trigger selection
      const selected = await page.evaluate((bId) => {
        if (typeof window.__DRAS_SELECT_BUILDING__ === 'function') {
          return window.__DRAS_SELECT_BUILDING__(bId);
        }
        return false;
      }, b.id);

      await sleep(500);

      // Audit the right-column inspector panel
      const audit = await page.evaluate(() => {
        // Target the right column (360px)
        const col = document.querySelector('div[style*="width: 360px"]');
        if (!col) return { foundColumn: false };

        const text = col.innerText;
        const hasNoData = /no data available/i.test(text);
        const hasStructureHeader = /Structure #/i.test(text);
        const hasEvidenceBadge = /EVIDENCE:/i.test(text);
        const hasSatelliteHeader = /AI SATELLITE EVIDENCE/i.test(text);
        const hasRationale = /Detection Rationale:/i.test(text);
        const hasDamageSection = /Damage Classification/i.test(text);
        const hasTriageCard = /Score:|Structural Severity/i.test(text);
        const hasResponseAction = /RESPONSE ACCESS ROUTE/i.test(text);
        const hasEvacuationAction = /EVACUATION ROUTE/i.test(text);

        const imgs = Array.from(col.querySelectorAll('img[src*="satellite_evidence"]')).map(i => ({
          src: i.src,
          complete: i.complete
        }));

        return {
          foundColumn: true,
          hasNoData,
          hasStructureHeader,
          hasEvidenceBadge,
          hasSatelliteHeader,
          hasRationale,
          hasDamageSection,
          hasTriageCard,
          hasResponseAction,
          hasEvacuationAction,
          dualSatelliteImages: imgs.length === 2
        };
      });

      const isPass = audit.foundColumn &&
                     !audit.hasNoData &&
                     audit.hasStructureHeader &&
                     audit.hasEvidenceBadge &&
                     audit.hasSatelliteHeader &&
                     audit.hasRationale &&
                     audit.hasDamageSection &&
                     audit.hasTriageCard &&
                     audit.hasResponseAction &&
                     audit.hasEvacuationAction &&
                     audit.dualSatelliteImages;

      if (isPass) {
        passedInteractions++;
        console.log(`  [PASS #${totalTested}] Scenario #${sid} Structure #${b.id} -> All 11 Inspector Criteria Verified`);
      } else {
        failures.push({ scenario: sid, buildingId: b.id, audit });
        console.log(`  [FAIL #${totalTested}] Scenario #${sid} Structure #${b.id} -> Incomplete:`, audit);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(` AUDIT RESULT: ${passedInteractions} / ${totalTested} BUILDINGS PASSED (100% SUCCESS TARGET)`);
  console.log('='.repeat(70));

  await browser.close();
  return failures.length === 0;
}

testBuildingInteractions().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
