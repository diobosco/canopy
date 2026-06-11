// Frame-accurate recorder: Playwright video capture misses the WebGL layer under
// SwiftShader in this headless container, but page.screenshot() does include it.
// So we grab a sequence of screenshots during a scripted run and stitch them to
// mp4 with ffmpeg. rAF keeps ticking during each screenshot await, so back-to-back
// captures naturally show motion.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const FFMPEG = '/tmp/ff/node_modules/ffmpeg-static/ffmpeg';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(8850, r));

const W = 1000, H = 625;
const frames = path.join(root, 'test', 'frames');
fs.rmSync(frames, { recursive: true, force: true });
fs.mkdirSync(frames, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--no-sandbox', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.goto('http://localhost:8850/index.html', { waitUntil: 'load' });
await page.evaluate(() => window.gsap && window.gsap.ticker.lagSmoothing(0));

let fi = 0;
async function cap(n = 1) {
  for (let k = 0; k < n; k++) {
    await page.screenshot({ path: path.join(frames, `f${String(fi).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 82 });
    fi++;
  }
}
async function dragCap(x, y, dx, dy, steps) {
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, e = 1 - Math.pow(1 - t, 3);
    await page.mouse.move(x + dx * e, y + dy * e);
    await cap(1);
  }
  await page.mouse.up();
}
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

const CX = W / 2, CY = H / 2;
await cap(20);                       // intro reveal
await dragCap(CX, CY, -300, -55, 26);    // orbit left
await cap(10);                       // inertia settle
await dragCap(CX, CY, 240, 120, 22);     // orbit right/down
await cap(10);

const card = await centreCard();     // hover
await page.mouse.move(card.x, card.y);
await cap(14);

await page.mouse.down(); await page.mouse.up();  // open detail
await cap(26);
await page.mouse.wheel(0, 600);      // scroll
await cap(14);
await page.mouse.wheel(0, -600);
await cap(10);
await page.evaluate(() => window.__detail.close());  // back
await cap(16);

await dragCap(CX, CY, 280, 40, 24);  // final orbit
await cap(12);

await browser.close();
server.close();

const count = fi;
console.log('captured frames:', count);

// assemble: input frames represent ~real-time motion; 16fps reads smooth here.
const out = path.join(root, 'spherical-gallery-demo.mp4');
execFileSync(FFMPEG, ['-y', '-framerate', '15', '-i', path.join(frames, 'f%04d.jpg'),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-crf', '23', '-preset', 'veryfast', out], { stdio: 'ignore' });
console.log('VIDEO:', out, (fs.statSync(out).size / 1e6).toFixed(2) + 'MB');
