// Records a scripted demo of the gallery to a video file so the result can be
// viewed without a live server. Serves the project + drives headless Chromium.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(8849, r));

const W = 1280, H = 800;
const vidDir = path.join(root, 'test', 'video');
fs.rmSync(vidDir, { recursive: true, force: true });
fs.mkdirSync(vidDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--no-sandbox', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
const context = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 1,
  recordVideo: { dir: vidDir, size: { width: W, height: H } },
});
const page = await context.newPage();
await page.goto('http://localhost:8849/index.html', { waitUntil: 'load' });
await page.evaluate(() => window.gsap && window.gsap.ticker.lagSmoothing(0));

const sleep = (ms) => page.waitForTimeout(ms);

// helper: smooth eased drag from (x,y) by (dx,dy) over n steps
async function drag(x, y, dx, dy, steps = 40) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
    await page.mouse.move(x + dx * e, y + dy * e);
    await sleep(16);
  }
  await page.mouse.up();
}

// find an on-screen card near the centre
async function centreCard() {
  return page.evaluate(() => {
    const g = window.__gallery; let best = null, bestD = Infinity;
    for (const c of g.cards) {
      const wp = c.position.clone().applyMatrix4(g.world.matrixWorld);
      const v = wp.clone().project(g.camera);
      if (v.z >= 1) continue;
      const d = Math.hypot(v.x, v.y + 0.05);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best && { x: (best.x * 0.5 + 0.5) * innerWidth, y: (-best.y * 0.5 + 0.5) * innerHeight };
  });
}

await sleep(2800);                       // intro
await drag(640, 400, -360, -60);         // orbit left
await sleep(900);
await drag(640, 400, 280, 140, 36);      // orbit right + down
await sleep(900);
await drag(640, 400, -160, -120, 30);    // settle
await sleep(1400);

let card = await centreCard();           // hover
await page.mouse.move(card.x, card.y);
await sleep(1500);

await page.mouse.down(); await page.mouse.up();  // open detail
await sleep(2600);
await page.mouse.wheel(0, 700);          // smooth scroll
await sleep(1800);
await page.mouse.wheel(0, -700);
await sleep(1400);
await page.evaluate(() => window.__detail.close());  // back
await sleep(1600);

await drag(640, 400, 320, 40, 36);       // a little more orbit
await sleep(1500);

await context.close();   // finalises the video
await browser.close();
server.close();

// rename the produced video to a stable path
const files = fs.readdirSync(vidDir).filter((f) => f.endsWith('.webm'));
const out = path.join(root, 'spherical-gallery-demo.webm');
fs.copyFileSync(path.join(vidDir, files[0]), out);
console.log('VIDEO:', out, (fs.statSync(out).size / 1e6).toFixed(2) + 'MB');
