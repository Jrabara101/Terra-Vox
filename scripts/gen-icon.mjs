// Generates the TerraVox app icon as an isometric voxel scene (SVG).
// Usage: node scripts/gen-icon.mjs public/favicon.svg
import { writeFileSync } from 'node:fs';

const voxels = new Map(); // "x,y,z" -> color
const key = (x, y, z) => `${x},${y},${z}`;
const put = (x, y, z, c) => voxels.set(key(x, y, z), c);
const has = (x, y, z) => voxels.has(key(x, y, z));

// Deterministic jitter so faces get a subtle pixel texture.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const GRASS = ['#5fbf4a', '#56b443', '#68c653', '#4fab3d'];
const DIRT = ['#8a5a36', '#7f5231', '#93623c'];
const STONE = ['#7c8590', '#727a85', '#858e99'];
const LEAF = ['#2f9e57', '#289150', '#36a95f'];
const TRUNK = '#6b4428';
const PLANK = ['#d9a866', '#cf9c5a'];
const ROOF = ['#c9483b', '#bd3f33'];
const WATER = '#3fa7e0';

const N = 5;
const DOOR = '#5a3a22';
const WINDOW = '#ffd76a';
// Island: stone base, dirt, grass top, a pond at the front corner.
for (let x = 0; x < N; x++)
  for (let z = 0; z < N; z++) {
    put(x, 0, z, pick(STONE));
    put(x, 1, z, pick(DIRT));
    const pond = (x === 4 && z === 4) || (x === 4 && z === 3) || (x === 3 && z === 4);
    put(x, 2, z, pond ? WATER : pick(GRASS));
  }

// Tree at the left corner.
put(0, 3, 3, TRUNK);
put(0, 4, 3, TRUNK);
for (let x = -1; x <= 1; x++)
  for (let z = 2; z <= 4; z++) put(x, 5, z, pick(LEAF));
put(0, 6, 3, pick(LEAF));
put(-1, 6, 3, pick(LEAF));
put(0, 6, 4, pick(LEAF));

// Village house at the back-right: 3x3 plank walls, stepped red roof.
for (let x = 2; x <= 4; x++)
  for (let z = 0; z <= 2; z++)
    for (let y = 3; y <= 4; y++) put(x, y, z, pick(PLANK));
put(3, 3, 2, DOOR);      // door on the left-facing wall
put(4, 4, 1, WINDOW);    // lit window on the right-facing wall
for (let x = 2; x <= 4; x++)
  for (let z = 0; z <= 2; z++) put(x, 5, z, pick(ROOF));
put(3, 6, 1, ROOF[0]);

// --- Isometric projection ---
const C = Math.cos(Math.PI / 6);
const S = Math.sin(Math.PI / 6);
const proj = ([x, y, z]) => [(x - z) * C, (x + z) * S - y];

const shade = (hex, f) => {
  if (hex === WINDOW) f = 1.15; // emissive: lit window ignores face shading
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
};

const faces = [];
const list = [...voxels.entries()].map(([k, c]) => [...k.split(',').map(Number), c]);
list.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]) || a[1] - b[1]);
for (const [x, y, z, c] of list) {
  if (!has(x, y + 1, z))
    faces.push({ pts: [[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]], fill: shade(c, 1.08) });
  if (!has(x, y, z + 1))
    faces.push({ pts: [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]], fill: shade(c, 0.82) });
  if (!has(x + 1, y, z))
    faces.push({ pts: [[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]], fill: shade(c, 0.62) });
}

// Fit scene into the icon.
const all = faces.flatMap((f) => f.pts.map(proj));
const minX = Math.min(...all.map((p) => p[0])), maxX = Math.max(...all.map((p) => p[0]));
const minY = Math.min(...all.map((p) => p[1])), maxY = Math.max(...all.map((p) => p[1]));
const SIZE = 512, FILL = 0.72;
const scale = (SIZE * FILL) / Math.max(maxX - minX, maxY - minY);
const ox = SIZE / 2 - ((minX + maxX) / 2) * scale;
const oy = SIZE / 2 - ((minY + maxY) / 2) * scale + 10;
const pt = (p) => { const [sx, sy] = proj(p); return `${(sx * scale + ox).toFixed(1)},${(sy * scale + oy).toFixed(1)}`; };

const polys = faces
  .map((f) => `<polygon points="${f.pts.map(pt).join(' ')}" fill="${f.fill}" stroke="${f.fill}" stroke-width="1" stroke-linejoin="round"/>`)
  .join('\n    ');

const stars = [[92, 96, 3], [150, 60, 2], [410, 84, 3], [448, 150, 2], [370, 48, 2], [70, 190, 2]]
  .map(([x, y, r]) => `<rect x="${x}" y="${y}" width="${r * 2}" height="${r * 2}" fill="#cfe6ff" opacity="0.8"/>`)
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#16244a"/>
      <stop offset="1" stop-color="#2b5a78"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.55" r="0.45">
      <stop offset="0" stop-color="#8fe3ff" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#8fe3ff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" rx="112" fill="url(#sky)"/>
  <rect width="${SIZE}" height="${SIZE}" rx="112" fill="url(#glow)"/>
  ${stars}
  <g>
    ${polys}
  </g>
</svg>
`;
writeFileSync(process.argv[2], svg);
console.log(`wrote ${process.argv[2]} (${faces.length} faces)`);
