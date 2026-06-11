// Self-contained verification harness: serves the project over HTTP and drives
// it with headless Chromium (Playwright) to capture console errors + screenshots.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('nf'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

await new Promise((r) => server.listen(8848, r));
console.log('server up on :8848');

const outDir = path.join(root, 'test', 'shots');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--no-sandbox',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto('http://localhost:8848/index.html', { waitUntil: 'load' });
// headless throttles rAF -> gsap lag-smoothing stalls time; disable it so the
// test runs at real-time like a visible 60fps browser would.
await page.evaluate(() => window.gsap && window.gsap.ticker.lagSmoothing(0));
await page.waitForTimeout(4000); // let intro play

const loaderState = await page.evaluate(() => {
  const l = document.getElementById('loader');
  return l ? getComputedStyle(l).opacity + ' vis=' + getComputedStyle(l).visibility : 'removed';
});
console.log('loader:', loaderState);
console.log('card count:', await page.evaluate(() => window.__gallery.cards.length));

// WebGL sanity: is anything actually drawn?
const glInfo = await page.evaluate(() => {
  const c = document.getElementById('scene');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  return { hasGL: !!gl, w: c.width, h: c.height,
    renderer: gl ? gl.getParameter(gl.VERSION) : null };
});
console.log('GL:', JSON.stringify(glInfo));

await page.screenshot({ path: path.join(outDir, '01-initial.png') });

// drag to orbit
const cx = 720, cy = 450;
await page.mouse.move(cx, cy);
await page.mouse.down();
for (let i = 0; i < 24; i++) { await page.mouse.move(cx - i * 14, cy - i * 4); await page.waitForTimeout(8); }
await page.mouse.up();
await page.waitForTimeout(2600); // let inertia fully settle so cards are stationary
await page.screenshot({ path: path.join(outDir, '02-after-drag.png') });

// find the screen position of an actual card facing the camera
const target = await page.evaluate(() => {
  const g = window.__gallery;
  let best = null, bestZ = -Infinity;
  for (const c of g.cards) {
    const wp = c.position.clone().applyMatrix4(g.world.matrixWorld);
    const v = wp.clone().project(g.camera);
    // visible & near centre & in front
    if (v.z < 1 && Math.abs(v.x) < 0.4 && Math.abs(v.y) < 0.4) {
      const dot = wp.clone().normalize().z; // crude facing metric
      if (-wp.z > bestZ) { bestZ = -wp.z; best = v; }
    }
  }
  if (!best) return null;
  return { x: (best.x * 0.5 + 0.5) * window.innerWidth, y: (-best.y * 0.5 + 0.5) * window.innerHeight };
});
console.log('card target:', JSON.stringify(target));

// hover that card
await page.mouse.move(target.x, target.y);
await page.waitForTimeout(700);
const pointing = await page.evaluate(() => document.body.classList.contains('pointing'));
console.log('pointing(hover):', pointing);
await page.screenshot({ path: path.join(outDir, '03-hover.png') });

// click to open detail
await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(1500);
const detailActive = await page.evaluate(() => document.getElementById('detail').classList.contains('is-active'));
console.log('detail active:', detailActive);
await page.screenshot({ path: path.join(outDir, '04-detail.png') });

// scroll the detail page (Lenis smooth scroll) to reveal body/credits
await page.mouse.move(720, 450);
await page.mouse.wheel(0, 900);
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(outDir, '05-detail-scroll.png') });
const scrolled = await page.evaluate(() => document.querySelector('.detail__scroll').scrollTop);
console.log('detail scrollTop:', Math.round(scrolled));

// close the detail and return to the gallery
await page.evaluate(() => window.__detail.close());
await page.waitForTimeout(1300);
const closed = await page.evaluate(() => ({
  active: document.getElementById('detail').classList.contains('is-active'),
  frozen: window.__gallery.frozen,
}));
console.log('after close:', JSON.stringify(closed));
await page.screenshot({ path: path.join(outDir, '06-closed.png') });

console.log('--- console logs ---');
console.log(logs.join('\n') || '(none)');

await browser.close();
server.close();
console.log('done');
