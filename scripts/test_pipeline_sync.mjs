import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('../frontend/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const FFMPEG_PATH = 'C:\\Users\\rajat\\AppData\\Roaming\\Python\\Python313\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe';

async function testPipelineSync() {
  const tempDir = './outputs/temp_test_sync';
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

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
  await new Promise(r => setTimeout(r, 1000));

  const client = await page.target().createCDPSession();
  const frames = [];
  let t0 = null;

  client.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    if (t0 === null) t0 = metadata.timestamp;
    const offset = metadata.timestamp - t0;
    const frameIndex = frames.length;
    const filename = `frame_${String(frameIndex).padStart(5, '0')}.jpg`;
    const filepath = path.join(tempDir, filename);
    fs.writeFileSync(filepath, Buffer.from(data, 'base64'));
    frames.push({ filename, offset, timestamp: metadata.timestamp });

    try {
      await client.send('Page.screencastFrameAck', { sessionId });
    } catch (e) {}
  });

  console.log('Starting 5-second screencast test...');
  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 90,
    maxWidth: 1920,
    maxHeight: 1080,
    everyNthFrame: 1
  });

  // Action 1: Pan map slightly
  for (let i = 0; i < 15; i++) {
    await page.evaluate((step) => {
      if (window.__DRAS_MAP__) window.__DRAS_MAP__.panBy([10, -5], { animate: false });
    }, i);
    await new Promise(r => setTimeout(r, 100));
  }

  // Action 2: Select destroyed building
  await page.evaluate(() => {
    if (window.__DRAS_SELECT_BUILDING__) window.__DRAS_SELECT_BUILDING__('destroyed');
  });
  await new Promise(r => setTimeout(r, 1500));

  // Action 3: Calculate response route
  await page.evaluate(() => {
    if (window.__DRAS_CALCULATE_ROUTE__) window.__DRAS_CALCULATE_ROUTE__('RESPONSE');
  });
  await new Promise(r => setTimeout(r, 2000));

  await client.send('Page.stopScreencast');
  await browser.close();

  console.log(`Captured ${frames.length} frames.`);
  if (frames.length === 0) throw new Error('No frames captured!');

  // Build ffconcat script
  const concatFile = path.join(tempDir, 'frames.txt');
  let concatContent = 'ffconcat version 1.0\n';
  for (let i = 0; i < frames.length; i++) {
    const cur = frames[i];
    let dur = 0.05;
    if (i < frames.length - 1) {
      dur = frames[i + 1].offset - cur.offset;
      if (dur <= 0 || isNaN(dur)) dur = 0.033;
    } else {
      dur = 0.5;
    }
    concatContent += `file ${cur.filename}\nduration ${dur.toFixed(4)}\n`;
  }
  // Repeat last frame
  concatContent += `file ${frames[frames.length - 1].filename}\n`;
  fs.writeFileSync(concatFile, concatContent);

  // Encode with FFmpeg
  const testOut = path.join(tempDir, 'test_sync.mp4');
  const cmd = `"${FFMPEG_PATH}" -y -f concat -safe 0 -i "${concatFile}" -c:v libx264 -pix_fmt yuv420p "${testOut}"`;
  console.log('Encoding test video with FFmpeg...');
  execSync(cmd, { stdio: 'pipe' });

  console.log(`Test video successfully created: ${testOut}`);
  const stats = fs.statSync(testOut);
  console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
}

testPipelineSync().catch(console.error);
