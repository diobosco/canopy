// Entry point — wires the gallery, the floating hover caption, the intro
// loader, and the detail page together.

import { Gallery } from './gallery.js';
import { Detail } from './detail.js';

const gsap = window.gsap;

const canvas = document.getElementById('scene');
const caption = document.getElementById('caption');
const captionTitle = caption.querySelector('.caption__title');
const captionMeta = caption.querySelector('.caption__meta');
const loader = document.getElementById('loader');
const hint = document.getElementById('hint');
const detailRoot = document.getElementById('detail');

const detail = new Detail({
  root: detailRoot,
  onClose: () => gallery.setFrozen(false),
});

const gallery = new Gallery({
  canvas,
  onSelect: (project, mesh) => {
    gallery.setFrozen(true);
    detail.show(project, gallery.getCardScreenPosition(mesh));
  },
  onHoverChange: (project) => {
    if (project) {
      captionTitle.textContent = project.title;
      captionMeta.textContent = `${project.category} · ${project.year}`;
      caption.classList.add('is-visible');
    } else {
      caption.classList.remove('is-visible');
    }
  },
});

// reflect the real card count in the UI
const countEl = document.getElementById('count');
if (countEl) countEl.textContent = `${gallery.cards.length} projects`;

// expose for devtools inspection / debugging
window.__gallery = gallery;
window.__detail = detail;

// move the floating caption with the cursor
window.addEventListener('pointermove', (e) => {
  gsap.to(caption, { x: e.clientX, y: e.clientY, duration: 0.5, ease: 'power3.out' });
});

// boot: hide loader, run the gallery intro, then fade the drag hint
window.addEventListener('load', kickoff);
if (document.readyState === 'complete') kickoff();

let booted = false;
function kickoff() {
  if (booted) return;
  booted = true;
  gsap.to(loader, {
    autoAlpha: 0,
    duration: 0.8,
    delay: 0.3,
    onComplete: () => loader.remove(),
  });
  gallery.intro();
  gsap.fromTo(hint, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 1, delay: 1.4 });
  gsap.to(hint, { autoAlpha: 0, duration: 0.8, delay: 6 });
}
