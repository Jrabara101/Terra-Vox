import { StorageLike } from './inventory';
import { BLOCK_DEFS, BlockId, BlueprintSummary, VillagePlot } from './types';
import { BlockChange, VoxelGrid } from './voxelGrid';

export const BLUEPRINTS_STORAGE_KEY = 'terravox_blueprints_v1';
export const MAX_BLUEPRINT_BLOCKS = 1800;

export interface VoxelBlueprintBlock {
  dx: number;
  dy: number;
  dz: number;
  blockId: BlockId;
}

export interface VoxelBlueprint {
  id: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  blocks: VoxelBlueprintBlock[];
  createdAt: number;
  sourceLabel?: string;
}

export function normalizeRotationTurns(turns: number): 0 | 1 | 2 | 3 {
  const m = ((Math.round(turns) % 4) + 4) % 4;
  return m as 0 | 1 | 2 | 3;
}

export function rotateBlueprintBlock(
  dx: number,
  dz: number,
  turns: number
): { dx: number; dz: number } {
  const t = normalizeRotationTurns(turns);
  if (t === 1) return { dx: -dz, dz: dx };
  if (t === 2) return { dx: -dx, dz: -dz };
  if (t === 3) return { dx: dz, dz: -dx };
  return { dx, dz };
}

export function getRotatedDimensions(
  bp: Pick<VoxelBlueprint, 'width' | 'height' | 'depth'>,
  turns: number
): { width: number; height: number; depth: number } {
  const t = normalizeRotationTurns(turns);
  return t % 2 === 1
    ? { width: bp.depth, height: bp.height, depth: bp.width }
    : { width: bp.width, height: bp.height, depth: bp.depth };
}

export function toBlueprintSummary(bp: VoxelBlueprint): BlueprintSummary {
  return {
    id: bp.id,
    name: bp.name,
    width: bp.width,
    height: bp.height,
    depth: bp.depth,
    blockCount: bp.blocks.length,
    sourceLabel: bp.sourceLabel,
  };
}

function isBlueprintCapturable(id: BlockId): boolean {
  return (
    id !== BlockId.Air &&
    id !== BlockId.Bedrock &&
    id !== BlockId.Water &&
    id !== BlockId.Lava &&
    id !== BlockId.PortalStone &&
    Boolean(BLOCK_DEFS[id]?.solid)
  );
}

/**
 * Copies all solid architectural/voxel blocks inside the inclusive box [cornerA, cornerB]
 * into a reusable blueprint centered horizontally around the bottom midpoint.
 */
export function captureBlueprintRegion(
  grid: VoxelGrid,
  cornerA: { x: number; y: number; z: number },
  cornerB: { x: number; y: number; z: number },
  name: string,
  sourceLabel?: string
): VoxelBlueprint | null {
  const minX = Math.floor(Math.min(cornerA.x, cornerB.x));
  const maxX = Math.floor(Math.max(cornerA.x, cornerB.x));
  const minY = Math.max(1, Math.floor(Math.min(cornerA.y, cornerB.y)));
  const maxY = Math.min(grid.sizeY - 1, Math.floor(Math.max(cornerA.y, cornerB.y)));
  const minZ = Math.floor(Math.min(cornerA.z, cornerB.z));
  const maxZ = Math.floor(Math.max(cornerA.z, cornerB.z));

  // Cap overly huge selections symmetrically around center
  const spanX = Math.min(24, maxX - minX + 1);
  const spanZ = Math.min(24, maxZ - minZ + 1);
  const spanY = Math.min(24, maxY - minY + 1);

  const originX = Math.floor((minX + minX + spanX - 1) / 2);
  const originZ = Math.floor((minZ + minZ + spanZ - 1) / 2);

  const blocks: VoxelBlueprintBlock[] = [];
  let actMinX = Infinity;
  let actMaxX = -Infinity;
  let actMinY = Infinity;
  let actMaxY = -Infinity;
  let actMinZ = Infinity;
  let actMaxZ = -Infinity;

  for (let y = minY; y < minY + spanY; y++) {
    for (let x = minX; x < minX + spanX; x++) {
      for (let z = minZ; z < minZ + spanZ; z++) {
        if (!grid.inBounds(x, y, z)) continue;
        const id = grid.getBlock(x, y, z);
        if (!isBlueprintCapturable(id)) continue;

        const dx = x - originX;
        const dy = y - minY;
        const dz = z - originZ;
        blocks.push({ dx, dy, dz, blockId: id });
        if (dx < actMinX) actMinX = dx;
        if (dx > actMaxX) actMaxX = dx;
        if (dy < actMinY) actMinY = dy;
        if (dy > actMaxY) actMaxY = dy;
        if (dz < actMinZ) actMinZ = dz;
        if (dz > actMaxZ) actMaxZ = dz;

        if (blocks.length >= MAX_BLUEPRINT_BLOCKS) break;
      }
      if (blocks.length >= MAX_BLUEPRINT_BLOCKS) break;
    }
    if (blocks.length >= MAX_BLUEPRINT_BLOCKS) break;
  }

  if (blocks.length === 0) return null;

  // Re-zero vertical base to lowest captured voxel
  if (actMinY > 0) {
    for (const b of blocks) {
      b.dy -= actMinY;
    }
    actMaxY -= actMinY;
  }

  const trimmedName = name.trim() || 'Custom Blueprint';
  return {
    id: `bp-${Date.now().toString(36)}-${Math.floor(Math.random() * 9999)}`,
    name: trimmedName.slice(0, 36),
    width: actMaxX - actMinX + 1,
    height: actMaxY + 1,
    depth: actMaxZ - actMinZ + 1,
    blocks,
    createdAt: Date.now(),
    sourceLabel,
  };
}

/**
 * Finds the nearest generated VillagePlot and captures its full house architecture
 * (foundation plinth, walls, windows, eaves, chimney, porch lanterns).
 */
export function captureNearestPlotBlueprint(
  grid: VoxelGrid,
  plots: VillagePlot[],
  px: number,
  pz: number,
  customName?: string
): VoxelBlueprint | null {
  if (plots.length === 0) return null;
  let nearest = plots[0];
  let bestDist = Infinity;
  for (const plot of plots) {
    const d = Math.hypot(plot.centerX - px, plot.centerZ - pz);
    if (d < bestDist) {
      bestDist = d;
      nearest = plot;
    }
  }

  const halfW = Math.ceil(nearest.width / 2) + 1;
  const halfD = Math.ceil(nearest.depth / 2) + 2;
  const cornerA = {
    x: nearest.centerX - halfW,
    y: Math.max(1, nearest.baseY - 1),
    z: nearest.centerZ - halfD,
  };
  const cornerB = {
    x: nearest.centerX + halfW,
    y: Math.min(grid.sizeY - 1, nearest.baseY + nearest.height + 2),
    z: nearest.centerZ + halfD,
  };

  return captureBlueprintRegion(
    grid,
    cornerA,
    cornerB,
    customName ?? `${nearest.label} Blueprint`,
    nearest.label
  );
}

/**
 * Stamps a saved blueprint onto the voxel grid at (anchorX, anchorY, anchorZ)
 * rotated clockwise around Y by `rotationTurns * 90°`. Returns undoable BlockChange batch.
 */
export function stampBlueprint(
  grid: VoxelGrid,
  blueprint: VoxelBlueprint,
  anchorX: number,
  anchorY: number,
  anchorZ: number,
  rotationTurns = 0
): { placedCount: number; batch: BlockChange[] } {
  const ax = Math.round(anchorX);
  const ay = Math.max(1, Math.round(anchorY));
  const az = Math.round(anchorZ);
  const batch: BlockChange[] = [];
  let placedCount = 0;

  for (const b of blueprint.blocks) {
    const rot = rotateBlueprintBlock(b.dx, b.dz, rotationTurns);
    const wx = ax + rot.dx;
    const wy = ay + b.dy;
    const wz = az + rot.dz;

    if (!grid.inBounds(wx, wy, wz)) continue;
    const prev = grid.getBlock(wx, wy, wz);
    if (prev === BlockId.Bedrock || prev === BlockId.PortalStone) continue;
    if (prev === b.blockId) continue;

    const prevAnchored = grid.isAnchored(wx, wy, wz);
    const nextAnchored = b.dy === 0;
    grid.setBlock(wx, wy, wz, b.blockId, nextAnchored);
    batch.push({
      x: wx,
      y: wy,
      z: wz,
      prevId: prev,
      nextId: b.blockId,
      prevAnchored,
      nextAnchored,
    });
    placedCount++;
  }

  return { placedCount, batch };
}

function getDefaultStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

export function loadBlueprints(storage?: StorageLike | null): VoxelBlueprint[] {
  const store = storage === undefined ? getDefaultStorage() : storage;
  if (!store) return [];
  try {
    const raw = store.getItem(BLUEPRINTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is VoxelBlueprint =>
        Boolean(item) &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        Array.isArray(item.blocks) &&
        item.blocks.length > 0
    );
  } catch {
    return [];
  }
}

export function saveBlueprints(
  blueprints: VoxelBlueprint[],
  storage?: StorageLike | null
): void {
  const store = storage === undefined ? getDefaultStorage() : storage;
  if (!store) return;
  try {
    store.setItem(BLUEPRINTS_STORAGE_KEY, JSON.stringify(blueprints.slice(0, 24)));
  } catch {
    // Ignore quota failures gracefully
  }
}
