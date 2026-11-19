import { fbm2D, mulberry32, ridgedNoise2D } from './noise';
import { solveStructuralStability } from './stability';
import { buildProceduralHouse } from './structures';
import { BlockId, NpcActor, NpcRole, VillagePlot, WorldConfig } from './types';
import { SECTOR_SIZE, VoxelGrid, WATER_LEVEL } from './voxelGrid';
import { createNpcActor } from './worldGen';

export interface DimensionSectorOutput {
  plots: VillagePlot[];
  npcs: NpcActor[];
  spawn?: { x: number; y: number; z: number; yaw: number };
}

const STARTER_CENTER_X = 16;
const STARTER_CENTER_Z = 16;

function placePalmTree(
  grid: VoxelGrid,
  x: number,
  baseY: number,
  z: number,
  rng: () => number
) {
  if (baseY + 9 >= grid.sizeY) return;
  const height = 5 + Math.floor(rng() * 3);
  const leanDirX = rng() > 0.5 ? 1 : -1;
  const leanDirZ = rng() > 0.5 ? 1 : 0;

  let cx = x;
  let cz = z;
  for (let dy = 0; dy < height; dy++) {
    if (dy === 2) cx += leanDirX;
    if (dy === 4) cz += leanDirZ;
    grid.setBlock(cx, baseY + dy, cz, BlockId.PalmWood, true);
  }

  const topY = baseY + height;
  // Tropical crown & drooping fronds
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
      if (Math.abs(dx) <= 1 || Math.abs(dz) <= 1) {
        grid.setBlock(cx + dx, topY, cz + dz, BlockId.PalmLeaves, true);
      }
    }
  }
  const tips: Array<[number, number]> = [
    [3, 0],
    [-3, 0],
    [0, 3],
    [0, -3],
    [2, 2],
    [-2, 2],
    [2, -2],
    [-2, -2],
  ];
  for (const [tx, tz] of tips) {
    grid.setBlock(cx + tx, topY - 1, cz + tz, BlockId.PalmLeaves, true);
  }
}

function placeVolcanicSpire(
  grid: VoxelGrid,
  x: number,
  baseY: number,
  z: number,
  rng: () => number
) {
  if (baseY + 7 >= grid.sizeY) return;
  const height = 3 + Math.floor(rng() * 4);
  for (let dy = 0; dy < height; dy++) {
    const block = dy === height - 1 && rng() > 0.45 ? BlockId.Magma : BlockId.Basalt;
    grid.setBlock(x, baseY + dy, z, block, true);
  }
}

export function generateVolcanicSector(
  grid: VoxelGrid,
  sx: number,
  sz: number,
  config: WorldConfig,
  sectorSeed: number,
  npcIndexStart: number
): DimensionSectorOutput {
  const rng = mulberry32(sectorSeed);
  const startX = sx * SECTOR_SIZE;
  const startZ = sz * SECTOR_SIZE;
  const endX = startX + SECTOR_SIZE;
  const endZ = startZ + SECTOR_SIZE;

  for (let x = startX; x < endX; x++) {
    for (let z = startZ; z < endZ; z++) {
      grid.setColumnBiome(x, z, 'redstone_oasis');
      const base = fbm2D(x * 0.035, z * 0.035, config.seed + 101, 4);
      const ridge = ridgedNoise2D(x * 0.04, z * 0.04, config.seed + 503, 3);
      let height = 7.5 + base * 5.5 * config.terrainAmplitude + ridge * 9.0 * config.terrainAmplitude;

      const distSpawn = Math.hypot(x - STARTER_CENTER_X, z - STARTER_CENTER_Z);
      if (distSpawn < 11) {
        const blend = Math.max(0, 1 - distSpawn / 11);
        height = height * (1 - blend) + 10.5 * blend;
      }

      const h = Math.max(3, Math.min(grid.sizeY - 10, Math.round(height)));
      grid.setBlock(x, 0, z, BlockId.Bedrock, true);
      for (let y = 1; y <= h; y++) {
        if (y < h - 2) {
          const isOre = y > 3 && rng() < 0.03;
          grid.setBlock(x, y, z, isOre ? BlockId.GoldOre : BlockId.Stone, true);
        } else if (y === h) {
          const magmaVein = y <= WATER_LEVEL + 1 || (ridge > 0.62 && rng() < 0.35);
          grid.setBlock(x, y, z, magmaVein ? BlockId.Magma : BlockId.Basalt, true);
        } else {
          grid.setBlock(x, y, z, BlockId.Basalt, true);
        }
      }

      if (h < WATER_LEVEL) {
        for (let y = h + 1; y <= WATER_LEVEL; y++) {
          grid.setBlock(x, y, z, BlockId.Lava, true);
        }
      }
    }
  }

  for (let x = startX + 2; x <= endX - 3; x += 4) {
    for (let z = startZ + 2; z <= endZ - 3; z += 4) {
      if (Math.hypot(x - STARTER_CENTER_X, z - STARTER_CENTER_Z) < 10) continue;
      const topY = grid.getSurfaceY(x, z, false);
      const below = grid.getBlock(x, topY - 1, z);
      if (below === BlockId.Lava || topY - 1 <= WATER_LEVEL) continue;
      if (rng() < 0.28) {
        placeVolcanicSpire(grid, x, topY, z, rng);
      }
    }
  }

  const plots: VillagePlot[] = [];
  const npcs: NpcActor[] = [];
  let spawn: { x: number; y: number; z: number; yaw: number } | undefined;

  if (sx === 0 && sz === 0) {
    const cx = STARTER_CENTER_X;
    const cz = STARTER_CENTER_Z;
    const spawnX = cx + 0.5;
    const spawnZ = cz + 3.5;
    const sy = grid.getSurfaceY(cx, Math.floor(spawnZ), false);

    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        grid.setBlock(cx + dx, sy - 1, Math.floor(spawnZ) + dz, BlockId.Basalt, true);
        grid.setBlock(cx + dx, sy, Math.floor(spawnZ) + dz, BlockId.Air, false);
        grid.setBlock(cx + dx, sy + 1, Math.floor(spawnZ) + dz, BlockId.Air, false);
      }
    }

    const tower = buildProceduralHouse(
      grid,
      cx - 8,
      cz - 8,
      'watchtower',
      config.seed + 88,
      'Obsidian Outpost'
    );
    plots.push(tower.plot);
    solveStructuralStability(grid, cx, cz, 24);

    const specs: Array<{ role: NpcRole; x: number; z: number }> = [
      { role: 'golem', x: cx + 6.5, z: cz - 3.5 },
      { role: 'golem', x: cx - 5.5, z: cz - 5.5 },
      { role: 'wraith', x: cx + 9.5, z: cz - 9.5 },
      { role: 'slime', x: cx - 8.5, z: cz + 4.5 },
      { role: 'ranger', x: tower.doorX + 0.5, z: tower.doorZ + 1.5 },
    ];
    specs.forEach((s, idx) => {
      const y = grid.getSurfaceY(s.x, s.z, false);
      npcs.push(createNpcActor(s.role, s.x, y, s.z, npcIndexStart + idx, sectorSeed));
    });

    spawn = { x: spawnX, y: sy, z: spawnZ, yaw: 0 };
  } else if (rng() < 0.32) {
    const mx = startX + 16;
    const mz = startZ + 16;
    const my = grid.getSurfaceY(mx, mz, false);
    if (my - 1 > WATER_LEVEL) {
      const role: NpcRole = rng() < 0.45 ? 'golem' : rng() < 0.8 ? 'wraith' : 'slime';
      npcs.push(createNpcActor(role, mx + 0.5, my, mz + 0.5, npcIndexStart, sectorSeed));
    }
  }

  return { plots, npcs, spawn };
}

export function generateHawaiiBeachSector(
  grid: VoxelGrid,
  sx: number,
  sz: number,
  config: WorldConfig,
  sectorSeed: number,
  npcIndexStart: number
): DimensionSectorOutput {
  const rng = mulberry32(sectorSeed);
  const startX = sx * SECTOR_SIZE;
  const startZ = sz * SECTOR_SIZE;
  const endX = startX + SECTOR_SIZE;
  const endZ = startZ + SECTOR_SIZE;

  for (let x = startX; x < endX; x++) {
    for (let z = startZ; z < endZ; z++) {
      grid.setColumnBiome(x, z, 'emerald_plains');
      const islandNoise = fbm2D(x * 0.025, z * 0.025, config.seed + 211, 4);
      const wave = fbm2D(x * 0.06, z * 0.06, config.seed + 419, 2);
      // Gentle coastal slope with turquoise cove around starter beach
      let height = 7.4 + islandNoise * 5.2 + wave * 1.4;
      const distSpawn = Math.hypot(x - STARTER_CENTER_X, z - STARTER_CENTER_Z);
      if (distSpawn < 12) {
        const blend = Math.max(0, 1 - distSpawn / 12);
        height = height * (1 - blend) + 8.5 * blend;
      }

      const h = Math.max(3, Math.min(grid.sizeY - 12, Math.round(height)));
      grid.setBlock(x, 0, z, BlockId.Bedrock, true);
      for (let y = 1; y <= h; y++) {
        if (y < h - 2) {
          grid.setBlock(x, y, z, BlockId.Stone, true);
        } else if (h <= WATER_LEVEL + 2) {
          grid.setBlock(x, y, z, BlockId.BeachSand, true);
        } else {
          const top = y === h ? (h >= 12 ? BlockId.Basalt : BlockId.Grass) : BlockId.Dirt;
          grid.setBlock(x, y, z, top, true);
        }
      }

      if (h < WATER_LEVEL) {
        for (let y = h + 1; y <= WATER_LEVEL; y++) {
          grid.setBlock(x, y, z, BlockId.Water, true);
        }
        // Tropical reef coral clusters under shallow water
        if (h >= WATER_LEVEL - 2 && rng() < 0.08) {
          grid.setBlock(x, h + 1, z, BlockId.Coral, true);
        }
      }
    }
  }

  // Scatter swaying tropical coconut palm trees on golden sand & green headlands
  for (let x = startX + 3; x <= endX - 4; x += 5) {
    for (let z = startZ + 3; z <= endZ - 4; z += 5) {
      if (Math.hypot(x - STARTER_CENTER_X, z - STARTER_CENTER_Z) < 10) continue;
      const topY = grid.getSurfaceY(x, z, false);
      const below = grid.getBlock(x, topY - 1, z);
      if (below === BlockId.Water || topY - 1 <= WATER_LEVEL) continue;
      if (rng() < 0.35 * config.treeDensity) {
        placePalmTree(grid, x, topY, z, rng);
      }
    }
  }

  const plots: VillagePlot[] = [];
  const npcs: NpcActor[] = [];
  let spawn: { x: number; y: number; z: number; yaw: number } | undefined;

  if (sx === 0 && sz === 0) {
    const cx = STARTER_CENTER_X;
    const cz = STARTER_CENTER_Z;
    const spawnX = cx + 0.5;
    const spawnZ = cz + 3.5;
    const sy = grid.getSurfaceY(cx, Math.floor(spawnZ), false);

    // Clear golden beach boardwalk spawn plaza
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        grid.setBlock(cx + dx, sy - 1, Math.floor(spawnZ) + dz, BlockId.BeachSand, true);
        grid.setBlock(cx + dx, sy, Math.floor(spawnZ) + dz, BlockId.Air, false);
        grid.setBlock(cx + dx, sy + 1, Math.floor(spawnZ) + dz, BlockId.Air, false);
      }
    }

    const cabana = buildProceduralHouse(
      grid,
      cx - 7,
      cz - 8,
      'courtyard',
      config.seed + 71,
      'Aloha Beach Cabana'
    );
    plots.push(cabana.plot);
    solveStructuralStability(grid, cx, cz, 22);

    // Pair of welcoming tiki lantern posts & palm trees flanking shore
    placePalmTree(grid, cx + 8, grid.getSurfaceY(cx + 8, cz - 4, false), cz - 4, rng);
    placePalmTree(grid, cx - 10, grid.getSurfaceY(cx - 10, cz + 2, false), cz + 2, rng);

    const specs: Array<{ role: NpcRole; x: number; z: number }> = [
      { role: 'farmer', x: cabana.doorX + 0.5, z: cabana.doorZ + 1.5 },
      { role: 'ranger', x: cx + 4.5, z: cz - 2.5 },
      { role: 'songbird', x: cx + 2.5, z: cz - 6.5 },
      { role: 'songbird', x: cx - 6.5, z: cz - 4.5 },
      { role: 'fox', x: cx + 8.5, z: cz + 2.5 },
      { role: 'slime', x: cx - 8.5, z: cz + 5.5 },
    ];
    specs.forEach((s, idx) => {
      const y = grid.getSurfaceY(s.x, s.z, false);
      npcs.push(createNpcActor(s.role, s.x, y, s.z, npcIndexStart + idx, sectorSeed));
    });

    spawn = { x: spawnX, y: sy, z: spawnZ, yaw: 0 };
  } else if (rng() < 0.28) {
    const mx = startX + 16;
    const mz = startZ + 16;
    const my = grid.getSurfaceY(mx, mz, false);
    if (my - 1 > WATER_LEVEL) {
      const role: NpcRole = rng() < 0.4 ? 'songbird' : rng() < 0.75 ? 'fox' : 'ranger';
      npcs.push(createNpcActor(role, mx + 0.5, my, mz + 0.5, npcIndexStart, sectorSeed));
    }
  }

  return { plots, npcs, spawn };
}

export function generateDarkDungeonSector(
  grid: VoxelGrid,
  sx: number,
  sz: number,
  config: WorldConfig,
  sectorSeed: number,
  npcIndexStart: number
): DimensionSectorOutput {
  const rng = mulberry32(sectorSeed);
  const startX = sx * SECTOR_SIZE;
  const startZ = sz * SECTOR_SIZE;
  const endX = startX + SECTOR_SIZE;
  const endZ = startZ + SECTOR_SIZE;

  const ceilingY = 25;

  for (let x = startX; x < endX; x++) {
    for (let z = startZ; z < endZ; z++) {
      grid.setColumnBiome(x, z, 'alpine_peaks');
      const roomNoise = fbm2D(x * 0.055, z * 0.055, config.seed + 307, 3);
      let floorY = 8 + Math.round(roomNoise * 2.5);
      const distSpawn = Math.hypot(x - STARTER_CENTER_X, z - STARTER_CENTER_Z);
      if (distSpawn < 14) {
        floorY = 9;
      }

      grid.setBlock(x, 0, z, BlockId.Bedrock, true);
      for (let y = 1; y <= floorY; y++) {
        const isTrim = (x % 6 === 0 || z % 6 === 0) && y === floorY;
        const block =
          y < floorY - 1
            ? BlockId.DungeonSlate
            : isTrim
            ? BlockId.DungeonSlate
            : BlockId.DungeonBrick;
        grid.setBlock(x, y, z, block, true);
      }

      // Vaulted stone dungeon ceiling with narrow starry/abyssal skylight ribs
      const isVaultRib = x % 8 === 0 || z % 8 === 0;
      const isSkylightSlot = !isVaultRib && Math.abs(x % 16) === 4 && Math.abs(z % 16) === 4;
      if (!isSkylightSlot) {
        grid.setBlock(x, ceilingY, z, isVaultRib ? BlockId.DungeonSlate : BlockId.DungeonBrick, true);
        if (isVaultRib) {
          grid.setBlock(x, ceilingY - 1, z, BlockId.DungeonSlate, true);
        }
      }
    }
  }

  // Carved gothic dungeon pillars + lantern sconces + gilded treasure shrines
  for (let x = startX + 4; x <= endX - 4; x += 8) {
    for (let z = startZ + 4; z <= endZ - 4; z += 8) {
      if (Math.hypot(x - STARTER_CENTER_X, z - STARTER_CENTER_Z) < 9) continue;
      const floorTop = grid.getSurfaceY(x, z, false);
      for (let y = floorTop; y < ceilingY; y++) {
        const isBaseOrCap = y === floorTop || y === ceilingY - 1;
        grid.setBlock(
          x,
          y,
          z,
          isBaseOrCap ? BlockId.DungeonSlate : BlockId.DungeonBrick,
          true
        );
      }
      // Glowing lantern bracket mounted on pillar side
      grid.setBlock(x + 1, floorTop + 2, z, BlockId.Lantern, true);
      if (rng() < 0.25) {
        grid.setBlock(x, floorTop, z + 1, BlockId.GoldOre, true);
      }
    }
  }

  const plots: VillagePlot[] = [];
  const npcs: NpcActor[] = [];
  let spawn: { x: number; y: number; z: number; yaw: number } | undefined;

  if (sx === 0 && sz === 0) {
    const cx = STARTER_CENTER_X;
    const cz = STARTER_CENTER_Z;
    const spawnX = cx + 0.5;
    const spawnZ = cz + 3.5;
    const sy = grid.getSurfaceY(cx, Math.floor(spawnZ), false);

    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        grid.setBlock(cx + dx, sy - 1, Math.floor(spawnZ) + dz, BlockId.DungeonSlate, true);
        grid.setBlock(cx + dx, sy, Math.floor(spawnZ) + dz, BlockId.Air, false);
        grid.setBlock(cx + dx, sy + 1, Math.floor(spawnZ) + dz, BlockId.Air, false);
      }
    }

    // Torch-lit crypt archway shrine flanking starter chamber
    for (const lx of [cx - 4, cx + 4]) {
      grid.setBlock(lx, sy, cz + 1, BlockId.DungeonSlate, true);
      grid.setBlock(lx, sy + 1, cz + 1, BlockId.Lantern, true);
    }

    const keep = buildProceduralHouse(
      grid,
      cx - 8,
      cz - 8,
      'watchtower',
      config.seed + 66,
      'Shadow Crypt Keep'
    );
    plots.push(keep.plot);
    solveStructuralStability(grid, cx, cz, 24);

    const specs: Array<{ role: NpcRole; x: number; z: number }> = [
      { role: 'wraith', x: cx + 6.5, z: cz - 6.5 },
      { role: 'wraith', x: cx - 5.5, z: cz - 10.5 },
      { role: 'golem', x: cx + 8.5, z: cz + 1.5 },
      { role: 'slime', x: cx - 7.5, z: cz + 2.5 },
      { role: 'slime', x: cx + 3.5, z: cz - 11.5 },
      { role: 'ranger', x: keep.doorX + 0.5, z: keep.doorZ + 1.5 },
    ];
    specs.forEach((s, idx) => {
      const y = grid.getSurfaceY(s.x, s.z, false);
      npcs.push(createNpcActor(s.role, s.x, y, s.z, npcIndexStart + idx, sectorSeed));
    });

    spawn = { x: spawnX, y: sy, z: spawnZ, yaw: 0 };
  } else if (rng() < 0.36) {
    const mx = startX + 16;
    const mz = startZ + 16;
    const my = grid.getSurfaceY(mx, mz, false);
    const role: NpcRole = rng() < 0.38 ? 'wraith' : rng() < 0.72 ? 'slime' : 'golem';
    npcs.push(createNpcActor(role, mx + 0.5, my, mz + 0.5, npcIndexStart, sectorSeed));
  }

  return { plots, npcs, spawn };
}
