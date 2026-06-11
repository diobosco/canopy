// Detail page — a basic templated project page that animates in when a card is
// tapped. GSAP drives the transition; Lenis provides smooth-scroll easing for
// the page content (the same easing family used for the gallery drag).

import Lenis from 'lenis';
import { createArtwork, createPhotoCard, loadImage } from './imageFactory.js';

const gsap = window.gsap;

export class Detail {
  constructor({ root, onClose }) {
    this.root = root;
    this.onClose = onClose || (() => {});
    this.open = false;
    this.lenis = null;
    this._build();
  }

  _build() {
    this.root.innerHTML = `
      <div class="detail__bg"></div>
      <button class="detail__close" aria-label="Back to gallery">
        <span class="detail__close-line"></span> Back to gallery
      </button>
      <div class="detail__scroll">
        <header class="detail__hero">
          <div class="detail__hero-media"><canvas class="detail__canvas"></canvas></div>
          <div class="detail__hero-text">
            <div class="detail__meta"></div>
            <h1 class="detail__title"></h1>
            <p class="detail__blurb"></p>
          </div>
        </header>
        <section class="detail__body">
          <div class="detail__col">
            <span class="detail__label">Overview</span>
            <p>This is a basic template page. The focus of this build is the spherical
               gallery itself — the orbiting wall of cards you tap to arrive here.</p>
            <p>The same procedural artwork that lives on the card is regenerated here at
               a larger scale, keeping the transition feeling continuous.</p>
          </div>
          <div class="detail__col">
            <span class="detail__label">Credits</span>
            <ul class="detail__list">
              <li><span>Direction</span><span>Studio Canopy</span></li>
              <li><span>Engine</span><span>Three.js + GSAP</span></li>
              <li><span>Motion</span><span>Lenis easing</span></li>
              <li><span>Year</span><span class="detail__year"></span></li>
            </ul>
          </div>
        </section>
        <div class="detail__strip"></div>
        <footer class="detail__footer">
          <button class="detail__close detail__close--footer">← Back to gallery</button>
        </footer>
      </div>
    `;

    this.bg = this.root.querySelector('.detail__bg');
    this.scroll = this.root.querySelector('.detail__scroll');
    this.canvas = this.root.querySelector('.detail__canvas');
    this.titleEl = this.root.querySelector('.detail__title');
    this.metaEl = this.root.querySelector('.detail__meta');
    this.blurbEl = this.root.querySelector('.detail__blurb');
    this.yearEl = this.root.querySelector('.detail__year');
    this.strip = this.root.querySelector('.detail__strip');

    this.root.querySelectorAll('.detail__close').forEach((b) =>
      b.addEventListener('click', () => this.close()));
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.open) this.close();
    });
  }

  show(project, photoUrl) {
    if (this.open) return;
    this.open = true;
    this.root.classList.add('is-active');
    this.root.style.pointerEvents = 'auto';

    // paint the larger card image (real photo when available, else procedural)
    const W = 900, H = 1125;
    this.canvas.width = W; this.canvas.height = H;
    const cctx = this.canvas.getContext('2d');
    cctx.drawImage(createArtwork(project, { width: W, height: H }), 0, 0); // immediate fallback
    if (photoUrl) {
      loadImage(photoUrl)
        .then((img) => { if (this.open) cctx.drawImage(createPhotoCard(project, img, { width: W, height: H }), 0, 0); })
        .catch(() => {});
    }

    const accent = project.palette.accents[0];
    this.titleEl.textContent = project.title;
    this.metaEl.textContent = `${String(project.index + 1).padStart(2, '0')} — ${project.category}`;
    this.blurbEl.textContent = project.blurb;
    this.yearEl.textContent = project.year;
    this.root.style.setProperty('--accent', accent);
    this.bg.style.background =
      `radial-gradient(120% 100% at 50% 0%, ${project.palette.bg[1]} 0%, ${project.palette.bg[0]} 60%, #04050a 100%)`;
    this.strip.style.background =
      `linear-gradient(90deg, ${project.palette.accents.join(', ')})`;

    // entrance timeline
    const media = this.root.querySelector('.detail__hero-media');
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    gsap.set(this.scroll, { autoAlpha: 1 });
    tl.fromTo(this.bg, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 0);
    tl.fromTo(media,
      { clipPath: 'inset(42% 18% 42% 18% round 16px)', autoAlpha: 0.6, scale: 1.05 },
      { clipPath: 'inset(0% 0% 0% 0% round 16px)', autoAlpha: 1, scale: 1, duration: 0.85 }, 0.05);
    tl.from('.detail__hero-text > *', { y: 32, autoAlpha: 0, duration: 0.6, stagger: 0.08 }, 0.35);
    tl.from('.detail__body, .detail__strip, .detail__footer',
      { y: 40, autoAlpha: 0, duration: 0.6, stagger: 0.06 }, 0.45);
    tl.from('.detail__close:not(.detail__close--footer)',
      { autoAlpha: 0, x: -10, duration: 0.5 }, 0.5);

    // smooth scroll for the page content
    this.lenis = new Lenis({
      wrapper: this.scroll,
      content: this.scroll,
      lerp: 0.09,
      smoothWheel: true,
    });
    this._raf = (t) => { if (this.lenis) { this.lenis.raf(t); requestAnimationFrame(this._raf); } };
    requestAnimationFrame(this._raf);
  }

  close() {
    if (!this.open) return;
    this.open = false;
    const media = this.root.querySelector('.detail__hero-media');
    const tl = gsap.timeline({
      defaults: { ease: 'power3.in' },
      onComplete: () => {
        this.root.classList.remove('is-active');
        this.root.style.pointerEvents = 'none';
        gsap.set(this.scroll, { autoAlpha: 0 });
        if (this.lenis) { this.lenis.destroy(); this.lenis = null; }
        this.onClose();
      },
    });
    tl.to('.detail__body, .detail__strip, .detail__footer, .detail__hero-text > *',
      { y: 24, autoAlpha: 0, duration: 0.3, stagger: 0.03 }, 0);
    tl.to(media, { clipPath: 'inset(42% 18% 42% 18% round 16px)', autoAlpha: 0, scale: 1.04, duration: 0.5 }, 0.1);
    tl.to(this.bg, { autoAlpha: 0, duration: 0.4 }, 0.25);
  }
}
