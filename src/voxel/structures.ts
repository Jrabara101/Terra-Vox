import { mulberry32 } from './noise';
import { BlockId, HouseStyle, NpcRole, VillagePlot } from './types';
import { VoxelGrid, WATER_LEVEL } from './voxelGrid';

export interface StructurePlacement {
  x: number;
  y: number;
  z: number;
  blockId: BlockId;
  anchored?: boolean;
}

export interface GeneratedHouseResult {
  plot: VillagePlot;
  placedCount: number;
  doorX: number;
  doorY: number;
  doorZ: number;
}

export interface VillageExpansionResult {
  plots: VillagePlot[];
  placedBlocks: number;
  newNpcSpawns: Array<{ role: NpcRole; x: number; y: number; z: number }>;
  plazaX: number;
  plazaY: number;
  plazaZ: number;
}

/**
 * Finds median ground height for a rectangular footprint so houses sit flush
 * on a leveled masonry foundation without floating or burying walls.
 */
export function prepareFoundationPad(
  grid: VoxelGrid,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  targetBaseY?: number
): number {
  let sumY = 0;
  let samples = 0;
  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      if (!grid.inBounds(x, 1, z)) continue;
      const sy = grid.getSurfaceY(x, z, false);
      sumY += sy;
      samples++;
    }
  }
  const avgY = samples > 0 ? Math.round(sumY / samples) : WATER_LEVEL + 2;
  const baseY = Math.max(WATER_LEVEL + 1, Math.min(grid.sizeY - 12, targetBaseY ?? avgY));

  for (let x = minX - 1; x <= maxX + 1; x++) {
    for (let z = minZ - 1; z <= maxZ + 1; z++) {
      if (!grid.inBounds(x, 1, z)) continue;
      // Clear above baseY inside pad
      const isInner = x >= minX && x <= maxX && z >= minZ && z <= maxZ;
      for (let y = baseY; y < Math.min(grid.sizeY - 1, baseY + 12); y++) {
        if (isInner || y <= baseY + 3) {
          grid.setBlock(x, y, z, BlockId.Air, false);
        }
      }
      // Fill beneath baseY down to solid terrain so foundation never floats
      for (let y = baseY - 1; y >= 1; y--) {
        const cur = grid.getBlock(x, y, z);
        if (cur === BlockId.Air || cur === BlockId.Water || cur === BlockId.OakLeaves || cur === BlockId.BlossomLeaves) {
          grid.setBlock(x, y, z, y === baseY - 1 ? BlockId.Cobblestone : BlockId.Stone, true);
        } else {
          break;
        }
      }
    }
  }

  return baseY;
}

/**
 * Procedurally constructs a full modular house (foundation, corner columns,
 * framed walls, glass windows, solid doorway jambs, pitched gable/battlement roof,
 * interior hearth & lantern) grounded cleanly on the terrain.
 */
export function buildProceduralHouse(
  grid: VoxelGrid,
  centerX: number,
  centerZ: number,
  style: HouseStyle,
  seed = 42,
  label?: string
): GeneratedHouseResult {
  const rng = mulberry32(seed);
  const cx = grid.isEndless
    ? Math.round(centerX)
    : Math.max(6, Math.min(grid.sizeX - 7, Math.round(centerX)));
  const cz = grid.isEndless
    ? Math.round(centerZ)
    : Math.max(6, Math.min(grid.sizeZ - 7, Math.round(centerZ)));

  const dims: Record<HouseStyle, { w: number; d: number; h: number; wall: BlockId; trim: BlockId; roof: BlockId }> = {
    cottage: {
      w: 7,
      d: 7,
      h: 4,
      wall: BlockId.OakPlanks,
      trim: BlockId.OakLog,
      roof: BlockId.RoofShingle,
    },
    watchtower: {
      w: 5,
      d: 5,
      h: 8,
      wall: BlockId.Cobblestone,
      trim: BlockId.Stone,
      roof: BlockId.RoofShingle,
    },
    barn: {
      w: 9,
      d: 7,
      h: 5,
      wall: BlockId.Brick,
      trim: BlockId.TimberBeam,
      roof: BlockId.OakPlanks,
    },
    courtyard: {
      w: 7,
      d: 7,
      h: 4,
      wall: BlockId.Sandstone,
      trim: BlockId.TimberBeam,
      roof: BlockId.Brick,
    },
  };

  const spec = dims[style];
  const halfW = Math.floor(spec.w / 2);
  const halfD = Math.floor(spec.d / 2);
  const minX = cx - halfW;
  const maxX = cx + halfW;
  const minZ = cz - halfD;
  const maxZ = cz + halfD;

  const baseY = prepareFoundationPad(grid, minX, maxX, minZ, maxZ);
  let placedCount = 0;

  const place = (x: number, y: number, z: number, id: BlockId, anchored = false) => {
    if (grid.setBlock(x, y, z, id, anchored)) {
      placedCount++;
    }
  };

  // 1. Stone/Cobble Plinth Floor
  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      const isEdge = x === minX || x === maxX || z === minZ || z === maxZ;
      place(x, baseY - 1, z, isEdge ? BlockId.Cobblestone : BlockId.OakPlanks, true);
    }
  }

  // 2. Walls, Corner Columns, Windows & Framed Doorway (South side maxZ)
  const doorX = cx;
  const doorZ = maxZ;

  for (let dy = 0; dy < spec.h; dy++) {
    const y = baseY + dy;
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        const onXEdge = x === minX || x === maxX;
        const onZEdge = z === minZ || z === maxZ;
        if (!onXEdge && !onZEdge) continue;

        const isCorner = onXEdge && onZEdge;
        const isDoor = z === doorZ && x === doorX && (dy === 0 || dy === 1);
        const isDoorJamb = z === doorZ && (x === doorX - 1 || x === doorX + 1) && dy <= 2;

        if (isDoor) {
          grid.setBlock(x, y, z, BlockId.Air, false);
          continue;
        }

        if (isCorner || isDoorJamb) {
          place(x, y, z, spec.trim, false);
          continue;
        }

        // Windows at eye level (dy === 1 or dy === 5 on watchtower)
        const isWindowLevel = dy === 1 || (style === 'watchtower' && dy === 5);
        const isLintelLevel = dy === 2 || (style === 'watchtower' && dy === 6);
        const isCenterSide =
          (onXEdge && z === cz) ||
          (z === minZ && x === cx) ||
          (style === 'barn' && onXEdge && (z === cz - 1 || z === cz + 1));

        if (isWindowLevel && isCenterSide) {
          place(x, y, z, BlockId.Glass, false);
        } else if ((isLintelLevel && isCenterSide) || dy === spec.h - 1) {
          // Structural lintel over window or top wall plate
          place(x, y, z, spec.trim, false);
        } else {
          place(x, y, z, spec.wall, false);
        }
      }
    }
  }

  // 3. Roof Architecture
  if (style === 'watchtower') {
    // Timber corbel deck + crenellated stone battlements + lantern beacon
    const roofY = baseY + spec.h;
    for (let x = minX - 1; x <= maxX + 1; x++) {
      for (let z = minZ - 1; z <= maxZ + 1; z++) {
        const isRim = x === minX - 1 || x === maxX + 1 || z === minZ - 1 || z === maxZ + 1;
        place(x, roofY, z, isRim ? BlockId.TimberBeam : BlockId.OakPlanks, false);
        if (isRim && (x + z) % 2 === 0) {
          place(x, roofY + 1, z, BlockId.Cobblestone, false);
        }
      }
    }
    place(cx, roofY + 1, cz, BlockId.OakLog, false);
    place(cx, roofY + 2, cz, BlockId.Lantern, false);
  } else if (style === 'courtyard') {
    // Flat stepped parapet terrace with corner lanterns
    const roofY = baseY + spec.h;
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        place(x, roofY, z, BlockId.OakPlanks, false);
        const isRim = x === minX || x === maxX || z === minZ || z === maxZ;
        if (isRim) {
          place(x, roofY + 1, z, BlockId.Sandstone, false);
        }
      }
    }
    place(minX, roofY + 2, maxZ, BlockId.Lantern, false);
    place(maxX, roofY + 2, maxZ, BlockId.Lantern, false);
  } else {
    // Classic Pitched Gable Roof with 1-block eave overhangs & orthogonal structural stepping
    const layers = halfW + 2;
    for (let layer = 0; layer < layers; layer++) {
      const y = baseY + spec.h + layer;
      const rxMin = minX - 1 + layer;
      const rxMax = maxX + 1 - layer;
      if (rxMin > rxMax) break;
      for (let z = minZ - 1; z <= maxZ + 1; z++) {
        // Outer eave/shingle course
        place(rxMin, y, z, spec.roof, false);
        if (rxMax !== rxMin) {
          place(rxMax, y, z, spec.roof, false);
        }
        // Step-support inner shoulder so next layer rests directly on solid masonry/roof
        if (rxMin + 1 <= rxMax - 1) {
          place(rxMin + 1, y, z, spec.roof, false);
          if (rxMax - 1 !== rxMin + 1) {
            place(rxMax - 1, y, z, spec.roof, false);
          }
        }
        // Gable end wall infill between slopes
        const isGableEnd = z === minZ || z === maxZ;
        if (isGableEnd) {
          for (let x = rxMin + 2; x <= rxMax - 2; x++) {
            place(x, y, z, spec.wall, false);
          }
        }
      }
    }
    // Structural Timber Tie-Beam & King Post Truss supporting the ridge span
    const ridgeY = baseY + spec.h + layers - 1;
    for (let x = minX; x <= maxX; x++) {
      place(x, baseY + spec.h, cz, BlockId.TimberBeam, false);
    }
    for (let y = baseY + spec.h + 1; y <= ridgeY - 1; y++) {
      place(cx, y, cz, BlockId.TimberBeam, false);
    }
    // Ridge beam connecting front and back gables + eaves
    for (let z = minZ - 1; z <= maxZ + 1; z++) {
      place(cx, ridgeY - 1, z, BlockId.TimberBeam, false);
      place(cx, ridgeY, z, spec.roof, false);
    }
    // Chimney on cottage/barn
    if (rng() > 0.25) {
      const chX = maxX - 1;
      const chZ = minZ + 1;
      for (let y = baseY; y <= baseY + spec.h + halfW + 2; y++) {
        place(chX, y, chZ, BlockId.Brick, false);
      }
    }
  }

  // 4. Exterior Stoop, Doorway Path & Grounded Porch Lantern Post
  place(doorX, baseY - 1, doorZ + 1, BlockId.Cobblestone, true);
  place(doorX, baseY - 1, doorZ + 2, BlockId.Cobblestone, true);
  place(doorX - 2, baseY - 1, doorZ + 1, BlockId.Cobblestone, true);
  place(doorX - 2, baseY, doorZ + 1, BlockId.OakLog, false);
  place(doorX - 2, baseY + 1, doorZ + 1, BlockId.OakLog, false);
  place(doorX - 2, baseY + 2, doorZ + 1, BlockId.Lantern, false);

  // Interior hearth table & lantern resting solidly on the table
  if (minX + 1 < cx) {
    place(minX + 1, baseY, minZ + 1, BlockId.OakLog, false);
    place(minX + 1, baseY + 1, minZ + 1, BlockId.Lantern, false);
  } else {
    place(cx, baseY, minZ + 1, BlockId.OakLog, false);
    place(cx, baseY + 1, minZ + 1, BlockId.Lantern, false);
  }

  const plot: VillagePlot = {
    id: `house-${cx}-${cz}-${Math.floor(rng() * 10000)}`,
    style,
    centerX: cx,
    baseY,
    centerZ: cz,
    width: spec.w,
    depth: spec.d,
    height: spec.h + halfW + 2,
    label: label ?? `${style.charAt(0).toUpperCase() + style.slice(1)}`,
  };

  return {
    plot,
    placedCount,
    doorX,
    doorY: baseY,
    doorZ: doorZ + 1,
  };
}

/**
 * Surveys terrain around (originX, originZ), constructs a stone plaza/well,
 * lays cobblestone streets to 3-4 distinct architectural plots, erects varied
 * houses, and returns NPC spawn coordinates for villagers.
 */
export function expandVillage(
  grid: VoxelGrid,
  originX: number,
  originZ: number,
  existingPlots: VillagePlot[],
  seed = 101
): VillageExpansionResult {
  const rng = mulberry32(seed);
  const cx = grid.isEndless
    ? Math.round(originX)
    : Math.max(16, Math.min(grid.sizeX - 17, Math.round(originX)));
  const cz = grid.isEndless
    ? Math.round(originZ)
    : Math.max(16, Math.min(grid.sizeZ - 17, Math.round(originZ)));

  // 1. Build Central Cobble Plaza & Lantern Well
  const plazaY = prepareFoundationPad(grid, cx - 2, cx + 2, cz - 2, cz + 2);
  let placedBlocks = 0;

  for (let x = cx - 2; x <= cx + 2; x++) {
    for (let z = cz - 2; z <= cz + 2; z++) {
      grid.setBlock(x, plazaY - 1, z, BlockId.Cobblestone, true);
      placedBlocks++;
    }
  }
  // Well rim + water + lantern canopy
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dz === 0) {
        grid.setBlock(cx, plazaY - 1, cz, BlockId.Water, true);
      } else {
        grid.setBlock(cx + dx, plazaY, cz + dz, BlockId.Cobblestone, false);
      }
      placedBlocks++;
    }
  }
  for (const px of [cx - 1, cx + 1]) {
    for (const pz of [cz - 1, cz + 1]) {
      grid.setBlock(px, plazaY + 1, pz, BlockId.OakLog, false);
      grid.setBlock(px, plazaY + 2, pz, BlockId.OakLog, false);
    }
  }
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      grid.setBlock(cx + dx, plazaY + 3, cz + dz, BlockId.RoofShingle, false);
    }
  }
  grid.setBlock(cx, plazaY + 2, cz, BlockId.Lantern, false);

  // 2. Candidate offsets around plaza for buildings
  const candidateOffsets: Array<{ dx: number; dz: number; style: HouseStyle; label: string }> = [
    { dx: -10, dz: -9, style: 'cottage', label: 'Timber Cottage' },
    { dx: 10, dz: -9, style: 'watchtower', label: 'Stone Watchtower' },
    { dx: -10, dz: 10, style: 'barn', label: 'Meadow Barn' },
    { dx: 10, dz: 10, style: 'courtyard', label: 'Sunlit Villa' },
  ];

  const plots: VillagePlot[] = [];
  const newNpcSpawns: Array<{ role: NpcRole; x: number; y: number; z: number }> = [];
  const roles: NpcRole[] = ['mason', 'farmer', 'ranger'];

  for (let i = 0; i < candidateOffsets.length; i++) {
    const cand = candidateOffsets[i];
    const px = grid.isEndless
      ? cx + cand.dx
      : Math.max(7, Math.min(grid.sizeX - 8, cx + cand.dx));
    const pz = grid.isEndless
      ? cz + cand.dz
      : Math.max(7, Math.min(grid.sizeZ - 8, cz + cand.dz));

    // Skip if overlapping an existing plot
    const overlaps = [...existingPlots, ...plots].some(
      (p) => Math.abs(p.centerX - px) < 9 && Math.abs(p.centerZ - pz) < 9
    );
    if (overlaps) continue;

    const house = buildProceduralHouse(grid, px, pz, cand.style, seed + i * 37, cand.label);
    plots.push(house.plot);
    placedBlocks += house.placedCount;

    // Lay cobblestone path from house door to plaza
    let pathX = house.doorX;
    let pathZ = house.doorZ;
    let steps = 0;
    while ((pathX !== cx || pathZ !== cz) && steps < 40) {
      steps++;
      const py = grid.getSurfaceY(pathX, pathZ, false);
      if (grid.inBounds(pathX, py - 1, pathZ)) {
        const curBelow = grid.getBlock(pathX, py - 1, pathZ);
        if (curBelow !== BlockId.Water) {
          grid.setBlock(pathX, py - 1, pathZ, BlockId.Cobblestone, true);
          // Ensure headroom along path
          grid.setBlock(pathX, py, pathZ, BlockId.Air, false);
          grid.setBlock(pathX, py + 1, pathZ, BlockId.Air, false);
          placedBlocks++;
        }
      }
      if (Math.abs(cx - pathX) >= Math.abs(cz - pathZ) && pathX !== cx) {
        pathX += cx > pathX ? 1 : -1;
      } else if (pathZ !== cz) {
        pathZ += cz > pathZ ? 1 : -1;
      }
    }

    // Spawn a villager near the house doorway
    newNpcSpawns.push({
      role: roles[(i + Math.floor(rng() * 3)) % roles.length],
      x: house.doorX + 0.5,
      y: house.doorY,
      z: house.doorZ + 0.5,
    });
  }

  // Add a friendly sheep or fox near plaza outskirts
  newNpcSpawns.push({
    role: rng() > 0.5 ? 'sheep' : 'fox',
    x: cx + 3.5,
    y: plazaY,
    z: cz + 3.5,
  });

  return {
    plots,
    placedBlocks,
    newNpcSpawns,
    plazaX: cx,
    plazaY,
    plazaZ: cz,
  };
}
