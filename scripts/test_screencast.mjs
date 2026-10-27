import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('../frontend/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function testScreencast() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-web-security', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));

  const client = await page.target().createCDPSession();
  let frameCount = 0;
  const tempDir = './outputs/temp_test_screencast';
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  client.on('Page.screencastFrame', async ({ data, sessionId }) => {
    frameCount++;
    if (frameCount <= 5) {
      fs.writeFileSync(path.join(tempDir, `frame_${frameCount}.jpg`), Buffer.from(data, 'base64'));
    }
    try {
      await client.send('Page.screencastFrameAck', { sessionId });
    } catch (e) {}
  });

  console.log('Starting screencast...');
  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 90,
    maxWidth: 1920,
    maxHeight: 1080,
    everyNthFrame: 1
  });

  // Scroll or do some action for 3 seconds
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => window.scrollBy(0, 20));
    await new Promise(r => setTimeout(r, 100));
  }

  await client.send('Page.stopScreencast');
  await browser.close();
  console.log(`Captured ${frameCount} frames during 3 seconds!`);
}

testScreencast().catch(console.error);
