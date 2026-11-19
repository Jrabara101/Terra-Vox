import {
  generateDarkDungeonSector,
  generateHawaiiBeachSector,
  generateVolcanicSector,
} from './dimensions';
import { fbm2D, mulberry32, ridgedNoise2D } from './noise';
import {
  PortalCoords,
  buildHugePortalStructure,
  scramblePortalPosition,
} from './portal';
import { solveStructuralStability } from './stability';
import { buildProceduralHouse } from './structures';
import {
  BiomeId,
  BlockId,
  HouseStyle,
  NpcActor,
  NpcRole,
  VillagePlot,
  WorldConfig,
} from './types';
import {
  INITIAL_SECTOR_RADIUS,
  SECTOR_SIZE,
  VoxelGrid,
  WATER_LEVEL,
  WORLD_SIZE_Y,
} from './voxelGrid';

export interface GeneratedWorldResult {
  grid: VoxelGrid;
  spawn: { x: number; y: number; z: number; yaw: number };
  portal: PortalCoords;
  plots: VillagePlot[];
  npcs: NpcActor[];
  primaryBiome: BiomeId;
}

export interface SectorGenerationResult {
  plots: VillagePlot[];
  npcs: NpcActor[];
  spawn?: { x: number; y: number; z: number; yaw: number };
}

const VILLAGER_NAMES: Record<NpcRole, string[]> = {
  mason: ['Alden', 'Bram', 'Kael', 'Talia'],
  farmer: ['Mira', 'Rowan', 'Pip', 'Soren'],
  ranger: ['Lyra', 'Vance', 'Orin', 'Faye'],
  sheep: ['Woolly', 'Clover', 'Pebble', 'Fluff'],
  fox: ['Rusty', 'Amber', 'Ember', 'Swift'],
  songbird: ['Pippin', 'Wren', 'Lark', 'Skye'],
  slime: ['Gloop', 'Verdant', 'Mossy', 'Bramble'],
  golem: ['Basalt', 'Crag', 'Cinder', 'Granite'],
  wraith: ['Vesper', 'Zephyr', 'Nyx', 'Gale'],
};

const STARTER_CENTER_X = 16;
const STARTER_CENTER_Z = 16;

function hashSectorSeed(sx: number, sz: number, baseSeed: number): number {
  let h = Math.imul(sx, 73856093) ^ Math.imul(sz, 19349663) ^ Math.imul(baseSeed, 83492791);
  h = (h ^ (h >>> 13)) | 0;
  return h >>> 0;
}

export function createNpcActor(
  role: NpcRole,
  x: number,
  y: number,
  z: number,
  index: number,
  seed: number
): NpcActor {
  const names = VILLAGER_NAMES[role];
  const name = names[(Math.abs(index) + Math.abs(seed)) % names.length];
  const isAnimal = role === 'sheep' || role === 'fox' || role === 'songbird';
  const isMonster = role === 'slime' || role === 'golem' || role === 'wraith';
  return {
    id: `npc-${role}-${index}-${seed}`,
    name,
    role,
    isAnimal,
    isMonster,
    x,
    y: role === 'songbird' ? y + 6 : role === 'wraith' ? y + 1.8 : y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: (Math.abs(index) * 1.7) % (Math.PI * 2),
    walkPhase: index * 0.9,
    state:
      role === 'songbird'
        ? 'soar'
        : role === 'wraith'
        ? 'hover'
        : isMonster
        ? 'prowl'
        : isAnimal
        ? 'graze'
        : 'patrol',
    stateTimer: 2 + (Math.abs(index) % 4),
    targetX: x,
    targetZ: z,
    homeX: x,
    homeZ: z,
    speech: '',
    speechTimer: 0,
  };
}

function classifyMixedBiome(x: number, z: number, seed: number): BiomeId {
  const temp = fbm2D(x * 0.014, z * 0.014, seed + 501, 3);
  const moisture = fbm2D(x * 0.014, z * 0.014, seed + 911, 3);
  if (temp > 0.22 && moisture < 0.05) return 'redstone_oasis';
  if (temp < -0.18) return 'alpine_peaks';
  if (moisture > 0.2) return 'blossom_grove';
  return 'emerald_plains';
}

function placeTree(
  grid: VoxelGrid,
  x: number,
  baseY: number,
  z: number,
  biome: BiomeId,
  rng: () => number
) {
  if (!grid.isEndless && (x < 3 || x >= grid.sizeX - 3 || z < 3 || z >= grid.sizeZ - 3)) return;
  if (baseY + 8 >= grid.sizeY) return;

  if (biome === 'alpine_peaks') {
    const height = 5 + Math.floor(rng() * 3);
    for (let dy = 0; dy < height; dy++) {
      grid.setBlock(x, baseY + dy, z, BlockId.OakLog, true);
    }
    for (let layer = 0; layer < 4; layer++) {
      const ly = baseY + height - 2 + layer;
      const r = layer === 3 ? 0 : layer === 0 ? 2 : 1;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && r > 0) continue;
          if (grid.getBlock(x + dx, ly, z + dz) === BlockId.Air) {
            grid.setBlock(x + dx, ly, z + dz, BlockId.OakLeaves, true);
          }
        }
      }
    }
    if (grid.getBlock(x, baseY + height + 2, z) === BlockId.Air) {
      grid.setBlock(x, baseY + height + 2, z, BlockId.Snow, true);
    }
    return;
  }

  if (biome === 'redstone_oasis') {
    const height = 4 + Math.floor(rng() * 2);
    for (let dy = 0; dy < height; dy++) {
      grid.setBlock(x, baseY + dy, z, BlockId.OakLog, true);
    }
    const topY = baseY + height;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if ((Math.abs(dx) <= 1 && Math.abs(dz) <= 1) || dx === 0 || dz === 0) {
          if (grid.getBlock(x + dx, topY, z + dz) === BlockId.Air) {
            grid.setBlock(x + dx, topY, z + dz, BlockId.OakLeaves, true);
          }
        }
      }
    }
    return;
  }

  const leafId = biome === 'blossom_grove' ? BlockId.BlossomLeaves : BlockId.OakLeaves;
  const height = 4 + Math.floor(rng() * 2);
  for (let dy = 0; dy < height; dy++) {
    grid.setBlock(x, baseY + dy, z, BlockId.OakLog, true);
  }
  for (let dy = height - 1; dy <= height + 1; dy++) {
    const rad = dy === height + 1 ? 1 : 2;
    for (let dx = -rad; dx <= rad; dx++) {
      for (let dz = -rad; dz <= rad; dz++) {
        if (Math.abs(dx) === rad && Math.abs(dz) === rad && rng() > 0.4) continue;
        if (grid.getBlock(x + dx, baseY + dy, z + dz) === BlockId.Air) {
          grid.setBlock(x + dx, baseY + dy, z + dz, leafId, true);
        }
      }
    }
  }
}

/**
 * Deterministically generates a single 32x36x32 world sector at (sx, sz),
 * including terrain strata, biome trees/boulders, and frontier settlements/wildlife.
 */
export function generateSector(
  grid: VoxelGrid,
  sx: number,
  sz: number,
  config: WorldConfig,
  npcIndexStart = 0
): SectorGenerationResult {
  if (grid.hasGeneratedSector(sx, sz)) {
    return { plots: [], npcs: [] };
  }

  const sector = grid.getOrCreateSector(sx, sz);
  const sectorSeed = hashSectorSeed(sx, sz, config.seed);
  const dimension = config.dimension ?? 'overworld';

  if (dimension === 'volcanic' || dimension === 'hawaii_beach' || dimension === 'dark_dungeon') {
    const dimRes =
      dimension === 'volcanic'
        ? generateVolcanicSector(grid, sx, sz, config, sectorSeed, npcIndexStart)
        : dimension === 'hawaii_beach'
        ? generateHawaiiBeachSector(grid, sx, sz, config, sectorSeed, npcIndexStart)
        : generateDarkDungeonSector(grid, sx, sz, config, sectorSeed, npcIndexStart);

    sector.generated = true;
    sector.dirty = true;
    grid.markSectorDirty(sx - 1, sz);
    grid.markSectorDirty(sx + 1, sz);
    grid.markSectorDirty(sx, sz - 1);
    grid.markSectorDirty(sx, sz + 1);
    return dimRes;
  }

  const rng = mulberry32(sectorSeed);

  const startX = sx * SECTOR_SIZE;
  const startZ = sz * SECTOR_SIZE;
  const endX = startX + SECTOR_SIZE;
  const endZ = startZ + SECTOR_SIZE;

  // 1. Generate terrain columns across this 32x32 sector
  for (let x = startX; x < endX; x++) {
    for (let z = startZ; z < endZ; z++) {
      const colBiome: BiomeId =
        config.biome === 'mixed' ? classifyMixedBiome(x, z, config.seed) : config.biome;
      grid.setColumnBiome(x, z, colBiome);

      const baseNoise = fbm2D(x * 0.032, z * 0.032, config.seed, 4);
      const detailNoise = fbm2D(x * 0.08, z * 0.08, config.seed + 313, 2);
      const ridge = ridgedNoise2D(x * 0.028, z * 0.028, config.seed + 777, 3);

      let height = 9 + baseNoise * 5 * config.terrainAmplitude + detailNoise * 1.6;
      if (colBiome === 'alpine_peaks') {
        height += ridge * 9 * config.terrainAmplitude;
      } else if (colBiome === 'redstone_oasis') {
        height = 8 + Math.round((baseNoise * 4.5 + ridge * 3) * config.terrainAmplitude);
      } else if (colBiome === 'blossom_grove') {
        height = 10 + baseNoise * 3.5 * config.terrainAmplitude;
      }

      // Gently flatten starter meadow clearing around (16, 16)
      const distFromCenter = Math.hypot(x - STARTER_CENTER_X, z - STARTER_CENTER_Z);
      if (distFromCenter < 11) {
        const blend = Math.max(0, 1 - distFromCenter / 11);
        height = height * (1 - blend) + 10 * blend;
      }

      const h = Math.max(3, Math.min(grid.sizeY - 9, Math.round(height)));

      grid.setBlock(x, 0, z, BlockId.Bedrock, true);
      for (let y = 1; y <= h; y++) {
        if (y < h - 3) {
          const isGold = colBiome === 'alpine_peaks' && y > 3 && rng() < 0.035;
          grid.setBlock(x, y, z, isGold ? BlockId.GoldOre : BlockId.Stone, true);
        } else if (y < h) {
          const subBlock =
            colBiome === 'redstone_oasis'
              ? BlockId.Sandstone
              : colBiome === 'alpine_peaks' && h > 15
              ? BlockId.Stone
              : BlockId.Dirt;
          grid.setBlock(x, y, z, subBlock, true);
        } else {
          let topBlock = BlockId.Grass;
          if (colBiome === 'redstone_oasis') {
            topBlock =
              y <= WATER_LEVEL + 1
                ? BlockId.Sandstone
                : rng() < 0.2
                ? BlockId.Brick
                : BlockId.Sandstone;
          } else if (colBiome === 'alpine_peaks') {
            topBlock = y >= 15 ? BlockId.Snow : y >= 12 ? BlockId.Stone : BlockId.Grass;
          }
          grid.setBlock(x, y, z, topBlock, true);
        }
      }

      if (h < WATER_LEVEL) {
        for (let y = h + 1; y <= WATER_LEVEL; y++) {
          grid.setBlock(x, y, z, BlockId.Water, true);
        }
      }
    }
  }

  // Decide ahead of tree scattering if this outer sector hosts a frontier homestead
  const isStarterSector = sx === 0 && sz === 0;
  const centerHx = startX + 16;
  const centerHz = startZ + 16;
  const centerSurfaceY = grid.getSurfaceY(centerHx, centerHz, false);
  const centerDry =
    centerSurfaceY - 1 > WATER_LEVEL &&
    centerSurfaceY < grid.sizeY - 12 &&
    grid.getBlock(centerHx, centerSurfaceY - 1, centerHz) !== BlockId.Water;
  const frontierRoll = rng();
  const hasFrontierOutpost =
    !isStarterSector &&
    (Math.abs(sx) >= 2 || Math.abs(sz) >= 2) &&
    ((Math.abs(sx) + Math.abs(sz)) % 2 === 0) &&
    centerDry &&
    frontierRoll < 0.24;

  // 2. Scatter biome trees & mossy boulders safely inside [start+2..end-3] so canopies stay within sector
  for (let x = startX + 2; x <= endX - 3; x += 3) {
    for (let z = startZ + 2; z <= endZ - 3; z += 3) {
      if (Math.hypot(x - STARTER_CENTER_X, z - STARTER_CENTER_Z) < 12) continue;
      if (hasFrontierOutpost && Math.hypot(x - centerHx, z - centerHz) < 7) continue;

      const biome = grid.getColumnBiome(x, z);
      const topY = grid.getSurfaceY(x, z, false);
      const topBlock = grid.getBlock(x, topY - 1, z);
      if (topBlock === BlockId.Water || topY - 1 <= WATER_LEVEL) continue;

      const treeChance =
        biome === 'blossom_grove'
          ? 0.28
          : biome === 'emerald_plains'
          ? 0.2
          : biome === 'alpine_peaks'
          ? 0.18
          : 0.08;

      if (rng() < treeChance * config.treeDensity) {
        const jx = Math.max(startX + 2, Math.min(endX - 3, x + Math.floor(rng() * 2) - 1));
        const jz = Math.max(startZ + 2, Math.min(endZ - 3, z + Math.floor(rng() * 2) - 1));
        const jy = grid.getSurfaceY(jx, jz, false);
        if (jy - 1 > WATER_LEVEL) {
          placeTree(grid, jx, jy, jz, biome, rng);
        }
      } else if (rng() < 0.06) {
        grid.setBlock(x, topY, z, BlockId.Cobblestone, true);
      }
    }
  }

  const plots: VillagePlot[] = [];
  const npcs: NpcActor[] = [];
  let spawn: { x: number; y: number; z: number; yaw: number } | undefined;

  if (isStarterSector) {
    const cx = STARTER_CENTER_X;
    const cz = STARTER_CENTER_Z;

    const cottage = buildProceduralHouse(
      grid,
      cx - 5,
      cz - 9,
      config.biome === 'redstone_oasis' ? 'courtyard' : 'cottage',
      config.seed + 11,
      'Founder Cottage'
    );
    plots.push(cottage.plot);

    const tower = buildProceduralHouse(
      grid,
      cx + 7,
      cz - 11,
      'watchtower',
      config.seed + 23,
      'Beacon Watchtower'
    );
    plots.push(tower.plot);

    // Connecting cobblestone walkway & lantern post
    for (let x = cx - 5; x <= cx + 7; x++) {
      const z = cz - 4;
      const py = grid.getSurfaceY(x, z, false);
      grid.setBlock(x, py - 1, z, BlockId.Cobblestone, true);
    }
    const postY = grid.getSurfaceY(cx + 3, cz - 4, false);
    grid.setBlock(cx + 3, postY, cz - 4, BlockId.OakLog, false);
    grid.setBlock(cx + 3, postY + 1, cz - 4, BlockId.Lantern, false);

    // Open 3x3 spawn plaza facing starter hamlet
    const spawnX = cx + 0.5;
    const spawnZ = cz + 3.5;
    const spawnSurfaceY = grid.getSurfaceY(cx, Math.floor(spawnZ), false);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        grid.setBlock(cx + dx, spawnSurfaceY - 1, Math.floor(spawnZ) + dz, BlockId.Grass, true);
        grid.setBlock(cx + dx, spawnSurfaceY, Math.floor(spawnZ) + dz, BlockId.Air, false);
        grid.setBlock(cx + dx, spawnSurfaceY + 1, Math.floor(spawnZ) + dz, BlockId.Air, false);
      }
    }

    // Starter hamlet summons villagers, animals, and voxel-art monsters by default
    const initialSpecs: Array<{ role: NpcRole; x: number; z: number }> = [
      { role: 'mason', x: cottage.doorX + 0.5, z: cottage.doorZ + 1.5 },
      { role: 'farmer', x: cx - 1.5, z: cz - 3.5 },
      { role: 'ranger', x: tower.doorX + 0.5, z: tower.doorZ + 1.5 },
      { role: 'sheep', x: cx - 7.5, z: cz + 2.5 },
      { role: 'sheep', x: cx - 9.5, z: cz + 4.5 },
      { role: 'fox', x: cx + 9.5, z: cz + 1.5 },
      { role: 'songbird', x: cx + 2.5, z: cz - 6.5 },
      { role: 'songbird', x: cx - 6.5, z: cz - 8.5 },
      { role: 'slime', x: cx + 7.5, z: cz + 0.5 },
      { role: 'golem', x: cx - 9.5, z: cz - 3.5 },
      { role: 'wraith', x: cx + 11.5, z: cz - 8.5 },
    ];

    initialSpecs.forEach((spec, idx) => {
      const sy = grid.getSurfaceY(spec.x, spec.z, false);
      npcs.push(createNpcActor(spec.role, spec.x, sy, spec.z, npcIndexStart + idx, config.seed));
    });

    solveStructuralStability(grid, cx, cz, 26);

    spawn = {
      x: spawnX,
      y: spawnSurfaceY,
      z: spawnZ,
      yaw: 0,
    };
  } else if (hasFrontierOutpost) {
    const sectorBiome = grid.getColumnBiome(centerHx, centerHz);
    const style: HouseStyle =
      sectorBiome === 'redstone_oasis'
        ? 'courtyard'
        : sectorBiome === 'alpine_peaks'
        ? 'watchtower'
        : rng() > 0.5
        ? 'cottage'
        : 'barn';
    const label =
      style === 'watchtower'
        ? 'Frontier Watchtower'
        : style === 'courtyard'
        ? 'Oasis Villa'
        : style === 'barn'
        ? 'Meadow Stead'
        : 'Frontier Homestead';

    const house = buildProceduralHouse(
      grid,
      centerHx,
      centerHz,
      style,
      sectorSeed + 17,
      label
    );
    plots.push(house.plot);
    solveStructuralStability(grid, centerHx, centerHz, 18);

    const villagerRoles: NpcRole[] = ['mason', 'farmer', 'ranger'];
    const vRole = villagerRoles[Math.floor(rng() * villagerRoles.length)];
    npcs.push(
      createNpcActor(
        vRole,
        house.doorX + 0.5,
        house.doorY,
        house.doorZ + 1.0,
        npcIndexStart,
        sectorSeed
      )
    );
    const wildRole: NpcRole = rng() > 0.45 ? 'sheep' : 'fox';
    const wy = grid.getSurfaceY(centerHx + 6, centerHz + 4, false);
    npcs.push(
      createNpcActor(wildRole, centerHx + 6.5, wy, centerHz + 4.5, npcIndexStart + 1, sectorSeed)
    );
  } else if (centerDry && rng() < 0.34) {
    // Roaming wildlife or voxel monsters in wilderness sectors
    const wildRole: NpcRole =
      frontierRoll < 0.24
        ? 'sheep'
        : frontierRoll < 0.44
        ? 'fox'
        : frontierRoll < 0.6
        ? 'songbird'
        : frontierRoll < 0.78
        ? 'slime'
        : frontierRoll < 0.91
        ? 'golem'
        : 'wraith';
    npcs.push(
      createNpcActor(
        wildRole,
        centerHx + 0.5,
        centerSurfaceY,
        centerHz + 0.5,
        npcIndexStart,
        sectorSeed
      )
    );
  }

  sector.generated = true;
  sector.dirty = true;
  // Refresh neighboring sectors so horizontal exposed faces along the boundary render seamlessly
  grid.markSectorDirty(sx - 1, sz);
  grid.markSectorDirty(sx + 1, sz);
  grid.markSectorDirty(sx, sz - 1);
  grid.markSectorDirty(sx, sz + 1);

  return { plots, npcs, spawn };
}

export function generateProceduralWorld(
  config: WorldConfig,
  portalRng: () => number = Math.random
): GeneratedWorldResult {
  const grid = VoxelGrid.createEndless(WORLD_SIZE_Y);
  const dimension = config.dimension ?? 'overworld';
  if (dimension === 'dark_dungeon') {
    grid.ceilingCutoffY = 21;
  }
  const plots: VillagePlot[] = [];
  const npcs: NpcActor[] = [];

  // Generate starter sector (0, 0) first so spawn is guaranteed
  const starterRes = generateSector(grid, 0, 0, config, 0);
  plots.push(...starterRes.plots);
  npcs.push(...starterRes.npcs);

  // Expand initial 3x world footprint (7x7 sectors = 224x36x224 blocks)
  for (let sx = -INITIAL_SECTOR_RADIUS; sx <= INITIAL_SECTOR_RADIUS; sx++) {
    for (let sz = -INITIAL_SECTOR_RADIUS; sz <= INITIAL_SECTOR_RADIUS; sz++) {
      if (sx === 0 && sz === 0) continue;
      const res = generateSector(grid, sx, sz, config, npcs.length);
      plots.push(...res.plots);
      npcs.push(...res.npcs);
    }
  }

  const spawn = starterRes.spawn ?? {
    x: STARTER_CENTER_X + 0.5,
    y: grid.getSurfaceY(STARTER_CENTER_X, STARTER_CENTER_Z + 3, false),
    z: STARTER_CENTER_Z + 3.5,
    yaw: 0,
  };

  // Build huge dimensional portal at a freshly scrambled XYZ coordinate on dry terrain
  const portal = scramblePortalPosition(
    grid,
    spawn.x,
    spawn.z,
    plots,
    null,
    portalRng,
    11,
    22
  );
  const daisBlock =
    dimension === 'volcanic'
      ? BlockId.Basalt
      : dimension === 'hawaii_beach'
      ? BlockId.Sandstone
      : dimension === 'dark_dungeon'
      ? BlockId.DungeonSlate
      : BlockId.Cobblestone;
  buildHugePortalStructure(grid, portal.x, portal.y, portal.z, daisBlock);
  solveStructuralStability(grid, portal.x, portal.z, 18);

  return {
    grid,
    spawn,
    portal,
    plots,
    npcs,
    primaryBiome: config.biome,
  };
}
