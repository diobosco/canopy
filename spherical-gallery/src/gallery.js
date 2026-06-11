// Spherical gallery — Three.js scene where the camera sits at the centre of a
// sphere and the project cards are mapped onto the inner surface, all facing
// inward toward the viewer. Left-click + drag orbits the view with smooth,
// Lenis-style eased motion and release inertia.

import * as THREE from 'three';
import { PROJECTS } from './data.js';
import { PHOTOS } from './photos.js';
import { createArtwork, createPhotoCard, loadImage } from './imageFactory.js';

const gsap = window.gsap;

// Rounded-rectangle card shader: samples the baked artwork and masks it with an
// anti-aliased rounded-rect SDF. Per-card uniforms drive hover / focus states.
const cardVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const cardFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uMap;
  uniform vec2 uSize;       // plane size in world units (for correct corner radius)
  uniform float uRadius;    // corner radius in world units
  uniform float uHover;     // 0..1 hover amount
  uniform float uDim;       // 0..1 dim amount when another card is focused
  uniform float uReveal;    // 0..1 intro reveal

  // signed distance to a rounded box
  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    vec2 halfSize = uSize * 0.5;
    float d = sdRoundBox(p, halfSize, uRadius);
    float aa = fwidth(d) * 1.2;
    float mask = 1.0 - smoothstep(-aa, aa, d);
    if (mask < 0.003) discard;

    vec3 col = texture2D(uMap, vUv).rgb;

    // hover: lift brightness + subtle saturation
    col *= mix(1.0, 1.18, uHover);
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(lum), col, mix(1.0, 1.12, uHover));

    // focus dim for non-hovered cards
    col = mix(col, vec3(lum) * 0.5 + col * 0.15, uDim * 0.85);

    // thin inner border that brightens on hover
    float border = smoothstep(aa, 0.0, abs(d + 0.012)) ;
    col += border * (0.05 + 0.5 * uHover);

    float alpha = mask * uReveal;
    gl_FragColor = vec4(col, alpha);
  }
`;

export class Gallery {
  constructor({ canvas, onSelect, onHoverChange }) {
    this.canvas = canvas;
    this.onSelect = onSelect || (() => {});
    this.onHoverChange = onHoverChange || (() => {});

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05060d, 0.028);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 100);
    this.camera.position.set(0, 0, 0.001);

    // world group holds all cards; we rotate this to "look around" the sphere
    this.world = new THREE.Group();
    this.scene.add(this.world);

    this.radius = 9;
    this.cards = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(999, 999);

    // scratch objects for the hover "level up" orientation
    this._tmpObj = new THREE.Object3D();
    this._tmpV = new THREE.Vector3();
    this._invWorldQ = new THREE.Quaternion();

    // rotation state (eased)
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.maxPitch = 0.62;
    this.momentum = { x: 0, y: 0 };

    // drag tracking
    this.dragging = false;
    this.moved = 0;
    this.last = { x: 0, y: 0 };
    this.downAt = 0;
    this.downPos = { x: 0, y: 0 };

    this.hovered = null;
    this.interactive = false;   // gates hover/click until intro completes
    this.frozen = false;        // pauses input while a detail page is open

    this._buildStars();
    this._bindEvents();
    this.resize();
    this._clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this._tick());
  }

  // Preload the photographs, then build the cards. Returns when ready.
  async load() {
    const results = await Promise.allSettled(PHOTOS.map(loadImage));
    const imgs = results.map((r) => (r.status === 'fulfilled' ? r.value : null));
    this._buildCards(imgs);
  }

  _buildCards(imgs) {
    // Spherical gallery: latitude rings, each with a column count proportional to
    // cos(latitude). This keeps every cell roughly the same angular size, so cards
    // stay evenly spaced and never overlap as longitude lines converge at the poles.
    const rows = 7;
    const baseCols = 20;                              // columns at the equator
    const latSpan = THREE.MathUtils.degToRad(132);   // total vertical coverage
    const aspect = 0.8;                              // card width / height
    const cardW = 2.18;
    const cardH = cardW / aspect;
    const cornerR = 0.13;

    let p = 0; // running index into PROJECTS (cycles if exhausted)
    for (let row = 0; row < rows; row++) {
      const v = rows === 1 ? 0.5 : row / (rows - 1);
      const phi = Math.PI / 2 + (v - 0.5) * latSpan; // polar angle from +Y
      const lat = Math.PI / 2 - phi;                  // latitude (0 at equator)
      const cols = Math.max(4, Math.round(baseCols * Math.cos(lat)));
      const rowOffset = (row % 2) * (Math.PI / cols) + row * 0.21; // organic stagger

      for (let col = 0; col < cols; col++) {
        const project = PROJECTS[p % PROJECTS.length];
        const photoUrl = PHOTOS[p % PHOTOS.length];
        const img = imgs[p % imgs.length];
        p++;
        const theta = (col / cols) * Math.PI * 2 + rowOffset;

        // real photo when available, procedural artwork as a fallback
        const cardCanvas = img ? createPhotoCard(project, img) : createArtwork(project);
        const tex = new THREE.CanvasTexture(cardCanvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.generateMipmaps = true;

        const material = new THREE.ShaderMaterial({
          uniforms: {
            uMap: { value: tex },
            uSize: { value: new THREE.Vector2(cardW, cardH) },
            uRadius: { value: cornerR },
            uHover: { value: 0 },
            uDim: { value: 0 },
            uReveal: { value: 0 },
          },
          vertexShader: cardVertex,
          fragmentShader: cardFragment,
          transparent: true,
          depthWrite: false,
        });

        const geo = new THREE.PlaneGeometry(cardW, cardH, 1, 1);
        const mesh = new THREE.Mesh(geo, material);

        // position on inner sphere surface
        const x = this.radius * Math.sin(phi) * Math.cos(theta);
        const y = this.radius * Math.cos(phi);
        const z = this.radius * Math.sin(phi) * Math.sin(theta);
        mesh.position.set(x, y, z);
        mesh.lookAt(0, 0, 0);    // face the centre (the camera)
        mesh.renderOrder = 1;

        mesh.userData = {
          project, material, photoUrl,
          basePos: mesh.position.clone(),
          baseQuat: mesh.quaternion.clone(), // rest orientation on the sphere
        };
        this.world.add(mesh);
        this.cards.push(mesh);
      }
    }
  }

  _buildStars() {
    // faint starfield for depth behind the cards
    const starGeo = new THREE.BufferGeometry();
    const N = 600;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const rr = 14 + Math.random() * 6;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = rr * Math.sin(p) * Math.cos(t);
      pos[i * 3 + 1] = rr * Math.cos(p);
      pos[i * 3 + 2] = rr * Math.sin(p) * Math.sin(t);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0x6a78c8, size: 0.05, transparent: true, opacity: 0.55, sizeAttenuation: true,
    }));
    this.world.add(stars);
    this.stars = stars;
  }

  // ---- intro reveal ----
  intro() {
    this.targetYaw = -0.6;
    this.yaw = -0.6;
    // fade the cards in with a randomised stagger
    gsap.to(this.cards.map((c) => c.userData.material.uniforms.uReveal), {
      value: 1,
      duration: 1.1,
      ease: 'power2.out',
      stagger: { each: 0.022, from: 'random' },
    });
    // settle the orbit from an angled start to centre
    gsap.fromTo(this, { yaw: -0.6, targetYaw: -0.6 }, {
      yaw: 0, targetYaw: 0, duration: 2.4, ease: 'power3.out',
      onComplete: () => { this.interactive = true; },
    });
  }

  // ---- input ----
  _bindEvents() {
    const el = this.canvas;
    el.addEventListener('pointerdown', (e) => this._onDown(e));
    window.addEventListener('pointermove', (e) => this._onMove(e));
    window.addEventListener('pointerup', (e) => this._onUp(e));
    window.addEventListener('resize', () => this.resize());
    // wheel = subtle eased zoom (fov)
    this.targetFov = 62;
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.targetFov = THREE.MathUtils.clamp(this.targetFov + e.deltaY * 0.02, 42, 78);
    }, { passive: false });
  }

  _onDown(e) {
    if (this.frozen || !this.interactive) return;
    this.dragging = true;
    this.moved = 0;
    this.downAt = performance.now();
    this.last = { x: e.clientX, y: e.clientY };
    this.downPos = { x: e.clientX, y: e.clientY };
    this.momentum.x = 0; this.momentum.y = 0;
    document.body.classList.add('grabbing');
  }

  _onMove(e) {
    // track pointer for hover raycast (normalised device coords)
    this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

    if (!this.dragging) return;
    const dx = e.clientX - this.last.x;
    const dy = e.clientY - this.last.y;
    this.last = { x: e.clientX, y: e.clientY };
    this.moved += Math.abs(dx) + Math.abs(dy);

    const sens = 0.0042;
    this.targetYaw += dx * sens;
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + dy * sens, -this.maxPitch, this.maxPitch);
    // remember last delta as release momentum
    this.momentum.x = dx * sens;
    this.momentum.y = dy * sens;
  }

  _onUp(e) {
    if (!this.dragging) return;
    this.dragging = false;
    document.body.classList.remove('grabbing');
    const dt = performance.now() - this.downAt;
    const dist = Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y);
    // treat as a click (not a drag) when it barely moved
    if (dist < 6 && dt < 400 && this.interactive && !this.frozen) {
      const hit = this._raycast();
      if (hit) this.onSelect(hit.userData.project, hit);
    }
  }

  _raycast() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.cards, false);
    return hits.length ? hits[0].object : null;
  }

  setFrozen(v) {
    this.frozen = v;
    if (v) {
      this.dragging = false;
      document.body.classList.remove('grabbing');
      this._setHover(null);
    }
  }

  _setHover(mesh) {
    if (this.hovered === mesh) return;
    if (this.hovered) {
      gsap.to(this.hovered.userData.material.uniforms.uHover, { value: 0, duration: 0.4, ease: 'power2.out' });
      gsap.to(this.hovered.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'power3.out' });
    }
    this.hovered = mesh;
    // dim all others when something is hovered
    const dim = mesh ? 1 : 0;
    this.cards.forEach((c) => {
      const u = c.userData.material.uniforms.uDim;
      gsap.to(u, { value: c === mesh ? 0 : dim, duration: 0.5, ease: 'power2.out' });
    });
    if (mesh) {
      gsap.to(mesh.userData.material.uniforms.uHover, { value: 1, duration: 0.4, ease: 'power2.out' });
      gsap.to(mesh.scale, { x: 1.08, y: 1.08, z: 1.08, duration: 0.5, ease: 'power3.out' });
      document.body.classList.add('pointing');
    } else {
      document.body.classList.remove('pointing');
    }
    this.onHoverChange(mesh ? mesh.userData.project : null);
  }

  // ---- frame ----
  _tick() {
    const dt = Math.min(this._clock.getDelta(), 0.05);

    if (!this.dragging && !this.frozen) {
      // apply decaying release momentum
      this.targetYaw += this.momentum.x;
      this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + this.momentum.y, -this.maxPitch, this.maxPitch);
      this.momentum.x *= 0.94;
      this.momentum.y *= 0.94;
      if (Math.abs(this.momentum.x) < 1e-5) this.momentum.x = 0;
      if (Math.abs(this.momentum.y) < 1e-5) this.momentum.y = 0;
    }

    // Lenis-style smoothing: ease current rotation toward target
    const ease = 1 - Math.pow(0.0009, dt); // ~0.09 per frame at 60fps, fps-independent
    this.yaw += (this.targetYaw - this.yaw) * ease;
    this.pitch += (this.targetPitch - this.pitch) * ease;

    this.world.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    if (this.stars) this.stars.rotation.y += dt * 0.01;

    // eased fov zoom
    if (this.targetFov != null) {
      this.camera.fov += (this.targetFov - this.camera.fov) * ease;
      this.camera.updateProjectionMatrix();
    }

    // hover detection (only when idle & interactive)
    if (this.interactive && !this.frozen && !this.dragging) {
      const hit = this._raycast();
      this._setHover(hit);
    } else if (this.dragging && this.hovered) {
      this._setHover(null);
    }

    this._updateCardFocus(dt);
    this.renderer.render(this.scene, this.camera);
  }

  // Ease the hovered card to face the viewer flat & upright (cancelling the
  // sphere's curvature roll); ease every other card back to its sphere pose.
  _updateCardFocus(dt) {
    const wq = this.world.quaternion;
    this._invWorldQ.copy(wq).invert();
    const k = 1 - Math.pow(0.0007, dt); // smoothing toward target per frame

    for (const card of this.cards) {
      if (card === this.hovered) {
        // world-space position of the card, then look back at the eye (origin)
        this._tmpV.copy(card.userData.basePos).applyQuaternion(wq);
        this._tmpObj.position.copy(this._tmpV);
        this._tmpObj.up.set(0, 1, 0);
        this._tmpObj.lookAt(0, 0, 0);
        // convert that world orientation into the rotating group's local frame
        this._tmpObj.quaternion.premultiply(this._invWorldQ);
        card.quaternion.slerp(this._tmpObj.quaternion, k);
      } else if (!card.quaternion.equals(card.userData.baseQuat)) {
        card.quaternion.slerp(card.userData.baseQuat, k);
      }
    }
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // expose a card's world data for the detail transition
  getCardScreenPosition(mesh) {
    const v = mesh.position.clone().applyMatrix4(this.world.matrixWorld).project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
    };
  }
}
