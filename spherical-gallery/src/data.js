// Project metadata for the gallery cards.
// The number of entries here defines how many cards exist; the gallery
// lays them out on a spherical grid. Each entry drives one procedural artwork.

const TITLES = [
  'Aurora Drift', 'Solar Bloom', 'Tidal Memory', 'Glass Horizon', 'Velvet Static',
  'Lucid Field', 'Echo Chamber', 'Paper Moon', 'Neon Garden', 'Slow Light',
  'Cobalt Dream', 'Ember Coast', 'Quiet Signal', 'Marble Sky', 'Phantom Reef',
  'Soft Machine', 'Liquid Index', 'Halcyon', 'Drift Theory', 'Noise Bloom',
  'Mirage Unit', 'Pale Sun', 'Inner Orbit', 'Resonance', 'Gradient State',
  'Helio', 'Undertow', 'Spectral', 'Monolith', 'Vapor Lines',
  'Continuum', 'Soft Static', 'After Image', 'Low Tide', 'Magnetic North',
  'Silt', 'Halftone', 'Parallax', 'Overcast', 'Bright Ash',
  'Cassette', 'Dusk Protocol', 'Iris', 'Cloud Atlas', 'Foam',
  'Signal Loss', 'Tangent', 'Verdant', 'Polar', 'Cinder',
  'Nocturne', 'Diffuse', 'Reverie', 'Cobblestone', 'Saffron',
  'Tideland', 'Heliotrope', 'Index Zero', 'Murmur', 'Static Field',
];

const CATEGORIES = [
  'Interactive', 'Identity', 'Motion', 'Spatial', 'Editorial',
  'Sound', 'Generative', 'Installation', 'Film', 'WebGL',
];

const YEARS = ['2021', '2022', '2023', '2024', '2025'];

// Curated palettes — dark, premium, vivid accents (phantom.land flavoured).
// Each: bg = two base tones for the ground gradient, accents = glow colors.
const PALETTES = [
  { bg: ['#0b0f2a', '#1a1140'], accents: ['#6a5cff', '#22d3ee', '#ff5c8a'] },
  { bg: ['#140a1e', '#2a0f2e'], accents: ['#ff6b6b', '#ffa94d', '#ffd43b'] },
  { bg: ['#06121a', '#0c2a2e'], accents: ['#2dd4bf', '#38bdf8', '#a3e635'] },
  { bg: ['#1a0e0a', '#2e1a10'], accents: ['#fb923c', '#f43f5e', '#fbbf24'] },
  { bg: ['#0a0a14', '#161430'], accents: ['#818cf8', '#c084fc', '#60a5fa'] },
  { bg: ['#0e0b16', '#241038'], accents: ['#e879f9', '#7dd3fc', '#f0abfc'] },
  { bg: ['#101418', '#1c2530'], accents: ['#94a3b8', '#38bdf8', '#e2e8f0'] },
  { bg: ['#1a1206', '#2a1e0a'], accents: ['#fde047', '#fb7185', '#fdba74'] },
  { bg: ['#08131a', '#0a2030'], accents: ['#22d3ee', '#3b82f6', '#67e8f9'] },
  { bg: ['#160a12', '#2c0e22'], accents: ['#f472b6', '#fb7185', '#c084fc'] },
  { bg: ['#0b1410', '#10271c'], accents: ['#34d399', '#a3e635', '#5eead4'] },
  { bg: ['#13101c', '#1e1438'], accents: ['#a78bfa', '#22d3ee', '#f472b6'] },
];

// Short lorem blurbs for the detail page template.
const BLURBS = [
  'An exploration of perception and depth, rendered as a living surface that responds to presence and motion.',
  'A study in light, gradient, and the quiet tension between stillness and drift.',
  'Built around a single gesture — pull, release, glide — and the spaces that open between frames.',
  'A spatial composition where every fragment is both a destination and a horizon.',
  'Form dissolving into field; an attempt to hold a moment of soft, atmospheric color.',
];

export const PROJECTS = Array.from({ length: 140 }, (_, i) => ({
  index: i,
  title: TITLES[i % TITLES.length],
  category: CATEGORIES[i % CATEGORIES.length],
  year: YEARS[(i * 7) % YEARS.length],
  palette: PALETTES[i % PALETTES.length],
  blurb: BLURBS[i % BLURBS.length],
  paletteIndex: i % PALETTES.length,
}));
