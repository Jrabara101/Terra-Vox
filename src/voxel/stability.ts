import { BLOCK_DEFS, BlockId } from './types';
import { VoxelGrid } from './voxelGrid';

export interface UnstableBlock {
  x: number;
  y: number;
  z: number;
  blockId: BlockId;
}

export interface StabilityReport {
  totalChecked: number;
  unstableBlocks: UnstableBlock[];
  averageIntegrity: number;
}

const STABILITY_DIRS = [
  [0, 1, 0],  // Up (supported from below)
  [1, 0, 0],  // +X cantilever
  [-1, 0, 0], // -X cantilever
  [0, 0, 1],  // +Z cantilever
  [0, 0, -1], // -Z cantilever
  [0, -1, 0], // Down (hanging)
];

function computeTransmissionCost(
  supportId: BlockId,
  neighborId: BlockId,
  dy: number
): number {
  const supportDef = BLOCK_DEFS[supportId];
  const nDef = BLOCK_DEFS[neighborId];
  if (!supportDef || !nDef || !supportDef.solid || !nDef.solid) return 100;

  if (dy === 1) {
    const massRatio = nDef.mass / Math.max(1, supportDef.loadCapacity);
    return massRatio > 0.22
      ? Math.round(18 + massRatio * 110)
      : Math.max(1, Math.round(1.5 + massRatio * 55));
  }
  if (dy === 0) {
    const effectiveSpan = Math.max(1, (supportDef.maxCantilever + nDef.maxCantilever) * 0.5);
    const massPenalty = Math.max(1, nDef.mass * 0.45);
    return Math.max(10, Math.round((100 / (effectiveSpan + 0.5)) * (0.72 + massPenalty * 0.22)));
  }
  return 48;
}

/**
 * Solves structural integrity (0..100) across either the full finite VoxelGrid
 * or a local 3D bounding window around (focusX, focusZ) in an endless world.
 */
export function solveStructuralStability(
  grid: VoxelGrid,
  focusX = 16,
  focusZ = 16,
  radius = 26
): StabilityReport {
  if (!grid.isEndless) {
    return solveFiniteGridStability(grid);
  }
  return solveWindowStability(
    grid,
    Math.round(focusX) - radius,
    Math.round(focusX) + radius,
    Math.round(focusZ) - radius,
    Math.round(focusZ) + radius
  );
}

function solveFiniteGridStability(grid: VoxelGrid): StabilityReport {
  const { sizeX, sizeY, sizeZ, blocks, anchored, integrity } = grid;
  const total = sizeX * sizeY * sizeZ;

  const buckets: number[][] = Array.from({ length: 101 }, () => []);
  let totalChecked = 0;

  for (let i = 0; i < total; i++) {
    const id = blocks[i] as BlockId;
    if (id === BlockId.Air || id === BlockId.Water) {
      integrity[i] = 0;
      continue;
    }
    totalChecked++;
    if (anchored[i] === 1) {
      integrity[i] = 100;
      buckets[100].push(i);
    } else {
      integrity[i] = 0;
    }
  }

  for (let level = 100; level >= 1; level--) {
    const bucket = buckets[level];
    for (let b = 0; b < bucket.length; b++) {
      const idx = bucket[b];
      if (integrity[idx] !== level) continue;

      const supportId = blocks[idx] as BlockId;
      const supportDef = BLOCK_DEFS[supportId];
      if (!supportDef || !supportDef.solid) continue;

      const y = Math.floor(idx / (sizeX * sizeZ));
      const rem = idx - y * sizeX * sizeZ;
      const z = Math.floor(rem / sizeX);
      const x = rem - z * sizeX;

      for (let d = 0; d < 6; d++) {
        const dx = STABILITY_DIRS[d][0];
        const dy = STABILITY_DIRS[d][1];
        const dz = STABILITY_DIRS[d][2];
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;

        if (!grid.inBounds(nx, ny, nz)) continue;
        const nIdx = grid.index(nx, ny, nz);
        if (anchored[nIdx] === 1) continue;

        const nId = blocks[nIdx] as BlockId;
        if (nId === BlockId.Air || nId === BlockId.Water) continue;
        const nDef = BLOCK_DEFS[nId];
        if (!nDef || !nDef.solid) continue;

        const cost = computeTransmissionCost(supportId, nId, dy);
        const nextIntegrity = level - cost;
        if (nextIntegrity > integrity[nIdx]) {
          integrity[nIdx] = nextIntegrity;
          buckets[nextIntegrity].push(nIdx);
        }
      }
    }
  }

  const unstableBlocks: UnstableBlock[] = [];
  let sumIntegrity = 0;

  for (let i = 0; i < total; i++) {
    const id = blocks[i] as BlockId;
    if (id === BlockId.Air || id === BlockId.Water) continue;
    const integ = integrity[i];
    sumIntegrity += integ;
    if (anchored[i] === 0 && integ <= 0) {
      const y = Math.floor(i / (sizeX * sizeZ));
      const rem = i - y * sizeX * sizeZ;
      const z = Math.floor(rem / sizeX);
      const x = rem - z * sizeX;
      unstableBlocks.push({ x, y, z, blockId: id });
    }
  }

  return {
    totalChecked,
    unstableBlocks,
    averageIntegrity: totalChecked > 0 ? Math.round(sumIntegrity / totalChecked) : 100,
  };
}

function solveWindowStability(
  grid: VoxelGrid,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number
): StabilityReport {
  const spanX = maxX - minX + 1;
  const spanZ = maxZ - minZ + 1;
  const sizeY = grid.sizeY;
  const total = spanX * sizeY * spanZ;

  const localBlocks = new Uint8Array(total);
  const localAnchored = new Uint8Array(total);
  const localIntegrity = new Uint8Array(total);
  const buckets: number[][] = Array.from({ length: 101 }, () => []);

  let totalChecked = 0;
  for (let y = 0; y < sizeY; y++) {
    for (let lz = 0; lz < spanZ; lz++) {
      const wz = minZ + lz;
      for (let lx = 0; lx < spanX; lx++) {
        const wx = minX + lx;
        const li = (y * spanZ + lz) * spanX + lx;
        const id = grid.getBlock(wx, y, wz);
        localBlocks[li] = id;
        if (id === BlockId.Air || id === BlockId.Water) continue;
        totalChecked++;
        const isEdgeBoundary = lx === 0 || lx === spanX - 1 || lz === 0 || lz === spanZ - 1;
        if (grid.isAnchored(wx, y, wz) || (isEdgeBoundary && grid.getIntegrity(wx, y, wz) > 0)) {
          const seedVal = grid.isAnchored(wx, y, wz) ? 100 : grid.getIntegrity(wx, y, wz);
          localAnchored[li] = grid.isAnchored(wx, y, wz) ? 1 : 0;
          localIntegrity[li] = seedVal;
          buckets[seedVal].push(li);
        }
      }
    }
  }

  for (let level = 100; level >= 1; level--) {
    const bucket = buckets[level];
    for (let b = 0; b < bucket.length; b++) {
      const idx = bucket[b];
      if (localIntegrity[idx] !== level) continue;

      const supportId = localBlocks[idx] as BlockId;
      const supportDef = BLOCK_DEFS[supportId];
      if (!supportDef || !supportDef.solid) continue;

      const y = Math.floor(idx / (spanX * spanZ));
      const rem = idx - y * spanX * spanZ;
      const lz = Math.floor(rem / spanX);
      const lx = rem - lz * spanX;

      for (let d = 0; d < 6; d++) {
        const nlx = lx + STABILITY_DIRS[d][0];
        const ny = y + STABILITY_DIRS[d][1];
        const nlz = lz + STABILITY_DIRS[d][2];
        if (nlx < 0 || nlx >= spanX || ny < 0 || ny >= sizeY || nlz < 0 || nlz >= spanZ) {
          continue;
        }
        const nIdx = (ny * spanZ + nlz) * spanX + nlx;
        if (localAnchored[nIdx] === 1) continue;

        const nId = localBlocks[nIdx] as BlockId;
        if (nId === BlockId.Air || nId === BlockId.Water) continue;
        const nDef = BLOCK_DEFS[nId];
        if (!nDef || !nDef.solid) continue;

        const cost = computeTransmissionCost(supportId, nId, STABILITY_DIRS[d][1]);
        const nextIntegrity = level - cost;
        if (nextIntegrity > localIntegrity[nIdx]) {
          localIntegrity[nIdx] = nextIntegrity;
          buckets[nextIntegrity].push(nIdx);
        }
      }
    }
  }

  const unstableBlocks: UnstableBlock[] = [];
  let sumIntegrity = 0;

  for (let y = 0; y < sizeY; y++) {
    for (let lz = 0; lz < spanZ; lz++) {
      const wz = minZ + lz;
      for (let lx = 0; lx < spanX; lx++) {
        const wx = minX + lx;
        const li = (y * spanZ + lz) * spanX + lx;
        const id = localBlocks[li] as BlockId;
        if (id === BlockId.Air || id === BlockId.Water) continue;
        const integ = localIntegrity[li];
        sumIntegrity += integ;
        if (localAnchored[li] === 0) {
          grid.setIntegrity(wx, y, wz, integ);
          if (integ <= 0) {
            unstableBlocks.push({ x: wx, y, z: wz, blockId: id });
          }
        }
      }
    }
  }

  return {
    totalChecked,
    unstableBlocks,
    averageIntegrity: totalChecked > 0 ? Math.round(sumIntegrity / totalChecked) : 100,
  };
}

/**
 * Removes all unstable blocks from the grid (or local edit window) and returns
 * them so the engine can spawn falling physics debris.
 */
export function collapseUnstableBlocks(
  grid: VoxelGrid,
  focusX = 16,
  focusZ = 16,
  radius = 26
): UnstableBlock[] {
  const report = solveStructuralStability(grid, focusX, focusZ, radius);
  for (const b of report.unstableBlocks) {
    grid.setBlock(b.x, b.y, b.z, BlockId.Air, false);
  }
  if (report.unstableBlocks.length > 0) {
    solveStructuralStability(grid, focusX, focusZ, radius);
  }
  return report.unstableBlocks;
}

export type BlockInstanceTint =
  | { mode: 'neutral'; tint: number }
  | { mode: 'heatmap'; hex: '#38d97c' | '#f5b041' | '#ef4444' };

/**
 * Computes per-instance color tint for voxel sector meshes.
 * Normal builds always return neutral grayscale luminance (0.94..1.06) so
 * default block textures & colors are preserved without green tinting.
 */
export function computeBlockInstanceTint(
  x: number,
  y: number,
  z: number,
  anchored: boolean,
  integrity: number,
  stabilityOverlay: boolean
): BlockInstanceTint {
  if (stabilityOverlay && !anchored) {
    if (integrity >= 75) return { mode: 'heatmap', hex: '#38d97c' };
    if (integrity >= 40) return { mode: 'heatmap', hex: '#f5b041' };
    return { mode: 'heatmap', hex: '#ef4444' };
  }
  const hash = ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) & 0xff;
  const tint = 0.94 + (hash / 255) * 0.12;
  return { mode: 'neutral', tint };
}
