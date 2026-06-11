// Procedural artwork generator.
// All gallery imagery is generated in-browser onto <canvas> elements so the
// experience is fully self-contained (no external image assets / network).
//
// Each artwork = layered gradient ground + soft accent "mesh" glows +
// a geometric motif + film grain + an editorial caption baked at the bottom.

// Tiny deterministic PRNG (mulberry32) so each card is stable across reloads.
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a, b, t) => a + (b - a) * t;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createArtwork(project, { width = 512, height = 640 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const r = rng(project.index * 2654435761 + 12345);
  const { bg, accents } = project.palette;

  // --- Ground gradient (angled) ---
  const ang = r() * Math.PI * 2;
  const cx = width / 2, cy = height / 2;
  const dx = Math.cos(ang) * width, dy = Math.sin(ang) * height;
  const g = ctx.createLinearGradient(cx - dx / 2, cy - dy / 2, cx + dx / 2, cy + dy / 2);
  g.addColorStop(0, bg[0]);
  g.addColorStop(1, bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  // --- Soft accent mesh glows ---
  ctx.globalCompositeOperation = 'screen';
  const blobs = 4 + Math.floor(r() * 3);
  for (let i = 0; i < blobs; i++) {
    const col = accents[Math.floor(r() * accents.length)];
    const [rr, gg, bb] = hexToRgb(col);
    const px = lerp(width * 0.05, width * 0.95, r());
    const py = lerp(height * 0.05, height * 0.95, r());
    const rad = lerp(width * 0.28, width * 0.8, r());
    const rg = ctx.createRadialGradient(px, py, 0, px, py, rad);
    const a = lerp(0.5, 0.92, r());
    rg.addColorStop(0, `rgba(${rr},${gg},${bb},${a})`);
    rg.addColorStop(0.5, `rgba(${rr},${gg},${bb},${a * 0.35})`);
    rg.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, width, height);
  }
  // one tight bright focal core for depth/interest
  {
    const col = accents[Math.floor(r() * accents.length)];
    const [rr, gg, bb] = hexToRgb(col);
    const px = lerp(width * 0.25, width * 0.75, r());
    const py = lerp(height * 0.2, height * 0.6, r());
    const rad = lerp(width * 0.08, width * 0.2, r());
    const rg = ctx.createRadialGradient(px, py, 0, px, py, rad);
    rg.addColorStop(0, `rgba(${rr},${gg},${bb},0.95)`);
    rg.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.globalCompositeOperation = 'source-over';

  // --- Geometric motif (one of several styles) ---
  const style = Math.floor(r() * 4);
  ctx.save();
  if (style === 0) {
    // concentric rings
    const ox = lerp(width * 0.2, width * 0.8, r());
    const oy = lerp(height * 0.2, height * 0.8, r());
    const col = accents[Math.floor(r() * accents.length)];
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 2;
    for (let i = 1; i <= 9; i++) {
      ctx.beginPath();
      ctx.arc(ox, oy, i * (width / 16), 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (style === 1) {
    // floating disc
    const ox = lerp(width * 0.3, width * 0.7, r());
    const oy = lerp(height * 0.28, height * 0.6, r());
    const rad = lerp(width * 0.16, width * 0.28, r());
    const col = accents[Math.floor(r() * accents.length)];
    const [rr, gg, bb] = hexToRgb(col);
    const disc = ctx.createRadialGradient(ox - rad * 0.3, oy - rad * 0.3, rad * 0.1, ox, oy, rad);
    disc.addColorStop(0, `rgba(${rr},${gg},${bb},0.95)`);
    disc.addColorStop(1, `rgba(${rr},${gg},${bb},0.15)`);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(ox, oy, rad, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === 2) {
    // diagonal scan lines
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    const step = 14;
    for (let x = -height; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + height, height);
      ctx.stroke();
    }
  } else {
    // wide arcs
    const col = accents[Math.floor(r() * accents.length)];
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = lerp(8, 22, r());
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const ar = lerp(width * 0.4, width * 0.9, r());
      const a0 = r() * Math.PI * 2;
      ctx.arc(width * r(), height * r(), ar, a0, a0 + Math.PI * lerp(0.4, 1.1, r()));
      ctx.stroke();
    }
  }
  ctx.restore();

  // --- Film grain ---
  const grain = document.createElement('canvas');
  grain.width = width; grain.height = height;
  const gctx = grain.getContext('2d');
  const img = gctx.createImageData(width, height);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (r() * 255) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 14;
  }
  gctx.putImageData(img, 0, 0);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.5;
  ctx.drawImage(grain, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  // --- Vignette ---
  const vg = ctx.createRadialGradient(cx, cy, width * 0.25, cx, cy, width * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, width, height);

  // --- Caption (baked editorial label) ---
  const scrim = ctx.createLinearGradient(0, height * 0.62, 0, height);
  scrim.addColorStop(0, 'rgba(0,0,0,0)');
  scrim.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, height * 0.62, width, height * 0.38);

  const pad = width * 0.07;
  ctx.textBaseline = 'alphabetic';
  // index + category (small, tracked)
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.font = `500 ${Math.round(width * 0.03)}px "Helvetica Neue", Arial, sans-serif`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
  const idx = String(project.index + 1).padStart(2, '0');
  ctx.fillText(`${idx} — ${project.category.toUpperCase()}`, pad, height - pad * 2.1);
  // title (large)
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${Math.round(width * 0.082)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(project.title, pad, height - pad * 1.0);

  return canvas;
}
