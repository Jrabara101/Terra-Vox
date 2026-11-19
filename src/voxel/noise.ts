/**
 * Deterministic PRNG & 2D/3D procedural noise utilities for terrain and biome generation.
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function valueNoise2D(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;

  const u = fade(fx);
  const v = fade(fz);

  const n00 = hash2(ix, iz, seed) * 2 - 1;
  const n10 = hash2(ix + 1, iz, seed) * 2 - 1;
  const n01 = hash2(ix, iz + 1, seed) * 2 - 1;
  const n11 = hash2(ix + 1, iz + 1, seed) * 2 - 1;

  const nx0 = lerp(n00, n10, u);
  const nx1 = lerp(n01, n11, u);
  return lerp(nx0, nx1, v);
}

export function fbm2D(
  x: number,
  z: number,
  seed: number,
  octaves = 4,
  lacunarity = 2.0,
  gain = 0.5
): number {
  let total = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxVal = 0;

  for (let i = 0; i < octaves; i++) {
    total += valueNoise2D(x * frequency, z * frequency, seed + i * 97) * amplitude;
    maxVal += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }

  return total / maxVal;
}

export function ridgedNoise2D(
  x: number,
  z: number,
  seed: number,
  octaves = 3
): number {
  let total = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxVal = 0;

  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise2D(x * frequency, z * frequency, seed + i * 131));
    total += n * n * amplitude;
    maxVal += amplitude;
    amplitude *= 0.5;
    frequency *= 2.1;
  }

  return total / maxVal;
}
