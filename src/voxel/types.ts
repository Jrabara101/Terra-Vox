export enum BlockId {
  Air = 0,
  Bedrock = 1,
  Grass = 2,
  Dirt = 3,
  Stone = 4,
  Cobblestone = 5,
  OakLog = 6,
  OakPlanks = 7,
  OakLeaves = 8,
  Sandstone = 9,
  Snow = 10,
  Brick = 11,
  RoofShingle = 12,
  Glass = 13,
  Water = 14,
  Lantern = 15,
  TimberBeam = 16,
  BlossomLeaves = 17,
  GoldOre = 18,
  Basalt = 19,
  Magma = 20,
  Lava = 21,
  BeachSand = 22,
  PalmWood = 23,
  PalmLeaves = 24,
  Coral = 25,
  DungeonBrick = 26,
  DungeonSlate = 27,
  PortalStone = 28,
}

export type DimensionId =
  | 'overworld'
  | 'volcanic'
  | 'hawaii_beach'
  | 'dark_dungeon';

export type PortalDestinationId = Exclude<DimensionId, 'overworld'>;

export type BiomeId =
  | 'mixed'
  | 'emerald_plains'
  | 'alpine_peaks'
  | 'redstone_oasis'
  | 'blossom_grove';

export type EditBrush = 'single' | 'platform3x3' | 'pillar4' | 'flatten';

export type HouseStyle = 'cottage' | 'watchtower' | 'barn' | 'courtyard';

export type SummonCategory = 'people' | 'animal' | 'monster';

export type NpcRole =
  | 'mason'
  | 'farmer'
  | 'ranger'
  | 'sheep'
  | 'fox'
  | 'songbird'
  | 'slime'
  | 'golem'
  | 'wraith';

export type NpcBehaviorState =
  | 'idle'
  | 'wander'
  | 'patrol'
  | 'socialize'
  | 'graze'
  | 'flee'
  | 'seek_shelter'
  | 'soar'
  | 'prowl'
  | 'hover';

export interface BlockDefinition {
  id: BlockId;
  name: string;
  shortName: string;
  color: string;
  topColor?: string;
  roughness: number;
  metalness: number;
  transparent: boolean;
  emissive: boolean;
  solid: boolean;
  /** Physical mass of a single block (kg-equivalent units) */
  mass: number;
  /** Maximum downward load capacity before column fails */
  loadCapacity: number;
  /** Maximum horizontal cantilever span without vertical support */
  maxCantilever: number;
  hotbarOrder?: number;
  roleHint?: string;
}

export const BLOCK_DEFS: Record<BlockId, BlockDefinition> = {
  [BlockId.Air]: {
    id: BlockId.Air,
    name: 'Air',
    shortName: 'Air',
    color: '#000000',
    roughness: 1,
    metalness: 0,
    transparent: true,
    emissive: false,
    solid: false,
    mass: 0,
    loadCapacity: 0,
    maxCantilever: 0,
  },
  [BlockId.Bedrock]: {
    id: BlockId.Bedrock,
    name: 'Bedrock',
    shortName: 'Bedrock',
    color: '#2b2d34',
    roughness: 0.95,
    metalness: 0.1,
    transparent: false,
    emissive: false,
    solid: true,
    mass: 10,
    loadCapacity: 9999,
    maxCantilever: 2,
  },
  [BlockId.Grass]: {
    id: BlockId.Grass,
    name: 'Meadow Grass',
    shortName: 'Grass',
    color: '#6b5139',
    topColor: '#569c46',
    roughness: 0.9,
    metalness: 0,
    transparent: false,
    emissive: false,
    solid: true,
    mass: 2,
    loadCapacity: 18,
    maxCantilever: 1,
    hotbarOrder: 1,
    roleHint: 'Natural turf',
  },
  [BlockId.Dirt]: {
    id: BlockId.Dirt,
    name: 'Rich Loam',
    shortName: 'Dirt',
    color: '#765338',
    roughness: 0.92,
    metalness: 0,
    transparent: false,
    emissive: false,
    solid: true,
    mass: 2,
    loadCapacity: 16,
    maxCantilever: 1,
  },
  [BlockId.Stone]: {
    id: BlockId.Stone,
    name: 'Granite Stone',
    shortName: 'Stone',
    color: '#7d838a',
    roughness: 0.82,
    metalness: 0.05,
    transparent: false,
    emissive: false,
    solid: true,
    mass: 4,
    loadCapacity: 90,
    maxCantilever: 2,
    hotbarOrder: 2,
    roleHint: 'Heavy foundation',
  },
  [BlockId.Cobblestone]: {
    id: BlockId.Cobblestone,
    name: 'Cobblestone',
    shortName: 'Cobble',
    color: '#696f75',
    roughness: 0.85,
    metalness: 0.05,
    transparent: false,
    emissive: false,
    solid: true,
    mass: 4,
    loadCapacity: 80,
    maxCantilever: 2,
    hotbarOrder: 3,
    roleHint: 'Masonry & paths',
  },
  [BlockId.OakLog]: {
    id: BlockId.OakLog,
    name: 'Oak Timber Log',
    shortName: 'Oak Log',
    color: '#6d4c30',
    topColor: '#a68255',
    roughness: 0.84,
    metalness: 0,
    transparent: false,
    emissive: false,
    solid: true,
    mass: 2,
    loadCapacity: 56,
    maxCantilever: 3,
    hotbarOrder: 4,
    roleHint: 'Load-bearing post',
  },
  [BlockId.OakPlanks]: {
    id: BlockId.OakPlanks,
    name: 'Oak Planks',
    shortName: 'Planks',
    color: '#b48752',
    roughness: 0.72,
    metalness: 0,
    transparent: false,
    emissive: false,
    solid: true,
    mass: 1.5,
    loadCapacity: 44,
    maxCantilever: 4,
    hotbarOrder: 5,
    roleHint: 'Modular framing',
  },
  [BlockId.OakLeaves]: {
    id: BlockId.OakLeaves,
    name: 'Oak Canopy',
    shortName: 'Leaves',
    color: '#3f7f38',
    roughness: 0.88,
    metalness: 0,
    transparent: false,
    emissive: false,
    solid: true,
    mass: 0.4,
    loadCapacity: 8,
    maxCantilever: 3,
  },
  [BlockId.Sandstone]: {
    id: BlockId.Sandstone,
    name: 'Warm Sandstone',
    shortName: 'Sandstone',
    color: '#d4b47c',
    roughness: 0.86,
    metalness: 0,
    transparent: false,
    emissive: false,
    solid: true,
    mass: 3,
    loadCapacity: 64,
    maxCantilever: 2,
  },
  [BlockId.Snow]: {
    id: BlockId.Snow,
    name: 'Alpine Snow',
    shortName: 'Snow',
    color: '#eef4fa',
    roughness: 0.65,
    metalness: 0.02,
    transparent: false,
    emissive: false,
    solid: true,
    mass: 1,
    loadCapacity: 12,
    maxCantilever: 1,
  },
  [BlockId.Brick]: {
    id: BlockId.Brick,
    name: 'Kiln Brick',
    shortName: 'Brick',
    color: '#a34d3c',
    roughness: 0.78,
    metalness: 0.02,
    transparent: false,
    emissive: false,
    solid: true,
    mass: 3.5,
    loadCapacity: 84,
    maxCantilever: 3,
    hotbarOrder: 6,
    roleHint: 'Arch & wall brick',
  },
  [BlockId.RoofShingle]: {
    id: BlockId.RoofShingle,
    name: 'Slate Shingle',
    shortName: 'Shingle',
    color: '#4b566a',
    roughness: 0.62,
    metalness: 0.12,
    transparent: false,
    emissive: false,
    solid: true,
    mass: 0.7,
    loadCapacity: 32,
    maxCantilever: 5,
    hotbarOrder: 7,
    roleHint: 'Weatherproof roof',
  },
  [BlockId.Glass]: {
    id: BlockId.Glass,
    name: 'Crystal Glass',
    shortName: 'Glass',
    color: '#a8d8eb',
    roughness: 0.12,
    metalness: 0.08,
    transparent: true,
    emissive: false,
    solid: true,
    mass: 1.2,
    loadCapacity: 20,
    maxCantilever: 1,
    hotbarOrder: 8,
    roleHint: 'Daylight window',
  },
  [BlockId.Water]: {
    id: BlockId.Water,
    name: 'Spring Water',
    shortName: 'Water',
    color: '#2e86ab',
    roughness: 0.14,
    metalness: 0.05,
    transparent: true,
    emissive: false,
    solid: false,
    mass: 1,
    loadCapacity: 0,
    maxCantilever: 0,
  },
  [BlockId.Lantern]: {
    id: BlockId.Lantern,
    name: 'Amber Lantern',
    shortName: 'Lantern',
    color: '#ffbe55',
    roughness: 0.28,
    metalness: 0.45,
    transparent: false,
    emissive: true,
    solid: true,
    mass: 0.8,
    loadCapacity: 16,
    maxCantilever: 2,
    hotbarOrder: 9,
    roleHint: 'Warm beacon light',
  },
  [BlockId.TimberBeam]: {
    id: BlockId.TimberBeam,
    name: 'Reinforced Truss',
    shortName: 'Truss',
    color: '#8f6137',
    roughness: 0.68,
    metalness: 0.18,
    transparent: false,
    emissive: false,
    solid: true,
    mass: 1.8,
    loadCapacity: 110,
    maxCantilever: 6,
  },
  [BlockId.BlossomLeaves]: {
    id: BlockId.BlossomLeaves,
    name: 'Blossom Petals',
    shortName: 'Blossom',
    color: '#eba0b6',
    roughness: 0.82,
    metalness: 0,
    transparent: false,
    emissive: false,
    solid: true,
    mass: 0.4,
    loadCapacity: 8,
    maxCantilever: 3,
  },
  [BlockId.GoldOre]: {
    id: BlockId.GoldOre,
    name: 'Gilded Ore',
    shortName: 'Gold Ore',
    color: '#cfa03c',
    roughness: 0.42,
    metalness: 0.58,
    transparent: false,
    emissive: false,
    solid: true,
    mass: 4.5,
    loadCapacity: 95,
    maxCantilever: 2,
  },
  [BlockId.Basalt]: {
    id: BlockId.Basalt,
    name: 'Volcanic Basalt',
    shortName: 'Basalt',
    color: '#2c2930',
    roughness: 0.88,
    metalness: 0.12,
    transparent: false,
    emissive: false,
    solid: true,
    mass: 4.5,
    loadCapacity: 96,
    maxCantilever: 2,
  },
  [BlockId.Magma]: {
    id: BlockId.Magma,
    name: 'Molten Crust',
    shortName: 'Magma',
    color: '#c94314',
    roughness: 0.55,
    metalness: 0.08,
    transparent: false,
    emissive: true,
    solid: true,
    mass: 3.8,
    loadCapacity: 70,
    maxCantilever: 2,
  },
  [BlockId.Lava]: {
    id: BlockId.Lava,
    name: 'Molten Lava',
    shortName: 'Lava',
    color: '#ff5e14',
    roughness: 0.2,
    metalness: 0,
    transparent: false,
    emissive: true,
    solid: false,
    mass: 1.2,
    loadCapacity: 0,
    maxCantilever: 0,
  },
  [BlockId.BeachSand]: {
    id: BlockId.BeachSand,
    name: 'Hawaii Golden Sand',
    shortName: 'Sand',
    color: '#f2dfb0',
    roughness: 0.88,
    metalness: 0,
    transparent: false,
    emissive: false,
    solid: true,
    mass: 1.8,
    loadCapacity: 24,
    maxCantilever: 1,
  },
  [BlockId.PalmWood]: {
    id: BlockId.PalmWood,
    name: 'Coconut Palm Trunk',
    shortName: 'Palm Log',
    color: '#8e6b47',
    roughness: 0.84,
    metalness: 0,
    transparent: false,
    emissive: false,
    solid: true,
    mass: 2.0,
    loadCapacity: 52,
    maxCantilever: 3,
  },
  [BlockId.PalmLeaves]: {
    id: BlockId.PalmLeaves,
    name: 'Tropical Palm Fronds',
    shortName: 'Fronds',
    color: '#3ca34b',
    roughness: 0.78,
    metalness: 0,
    transparent: false,
    emissive: false,
    solid: true,
    mass: 0.4,
    loadCapacity: 10,
    maxCantilever: 4,
  },
  [BlockId.Coral]: {
    id: BlockId.Coral,
    name: 'Reef Coral',
    shortName: 'Coral',
    color: '#ff6d8d',
    roughness: 0.72,
    metalness: 0.04,
    transparent: false,
    emissive: false,
    solid: true,
    mass: 1.6,
    loadCapacity: 30,
    maxCantilever: 2,
  },
  [BlockId.DungeonBrick]: {
    id: BlockId.DungeonBrick,
    name: 'Crypt Stone Brick',
    shortName: 'Crypt',
    color: '#383d4a',
    roughness: 0.82,
    metalness: 0.1,
    transparent: false,
    emissive: false,
    solid: true,
    mass: 4.2,
    loadCapacity: 100,
    maxCantilever: 3,
  },
  [BlockId.DungeonSlate]: {
    id: BlockId.DungeonSlate,
    name: 'Abyssal Slate',
    shortName: 'Slate',
    color: '#1d202b',
    roughness: 0.75,
    metalness: 0.18,
    transparent: false,
    emissive: false,
    solid: true,
    mass: 4.8,
    loadCapacity: 110,
    maxCantilever: 3,
  },
  [BlockId.PortalStone]: {
    id: BlockId.PortalStone,
    name: 'Dimensional Obsidian',
    shortName: 'Portal Stone',
    color: '#201533',
    roughness: 0.28,
    metalness: 0.45,
    transparent: false,
    emissive: true,
    solid: true,
    mass: 10,
    loadCapacity: 9999,
    maxCantilever: 4,
  },
};

export const HOTBAR_BLOCKS: BlockId[] = [
  BlockId.Grass,
  BlockId.Stone,
  BlockId.Cobblestone,
  BlockId.OakLog,
  BlockId.OakPlanks,
  BlockId.Brick,
  BlockId.RoofShingle,
  BlockId.Glass,
  BlockId.Lantern,
];

export const HOTBAR_BLOCKS_DIMENSIONS: BlockId[] = [
  BlockId.Basalt,
  BlockId.Magma,
  BlockId.BeachSand,
  BlockId.PalmWood,
  BlockId.PalmLeaves,
  BlockId.Coral,
  BlockId.DungeonBrick,
  BlockId.DungeonSlate,
  BlockId.GoldOre,
];

export const HOTBAR_PAGES: ReadonlyArray<{ id: number; label: string; blocks: BlockId[] }> = [
  { id: 0, label: 'Core', blocks: HOTBAR_BLOCKS },
  { id: 1, label: 'Realms', blocks: HOTBAR_BLOCKS_DIMENSIONS },
];

export interface BlueprintSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  blockCount: number;
  sourceLabel?: string;
}

export interface BiomePresetMeta {
  id: BiomeId;
  name: string;
  tagline: string;
  skyTop: string;
  skyHorizon: string;
  fogColor: string;
}

export const BIOME_PRESETS: Record<BiomeId, BiomePresetMeta> = {
  mixed: {
    id: 'mixed',
    name: 'Archipelago Realms',
    tagline: 'Blended plains, alpine ridges, oasis mesas & blossom groves',
    skyTop: '#5b9bd5',
    skyHorizon: '#d8e8f2',
    fogColor: '#cfe2ee',
  },
  emerald_plains: {
    id: 'emerald_plains',
    name: 'Emerald Plains',
    tagline: 'Rolling green meadows, oak groves & tranquil streams',
    skyTop: '#4e91cf',
    skyHorizon: '#d5ebf5',
    fogColor: '#cce4ef',
  },
  alpine_peaks: {
    id: 'alpine_peaks',
    name: 'Alpine Peaks',
    tagline: 'Snow-capped granite ridges, spruce pines & gilded veins',
    skyTop: '#648ec2',
    skyHorizon: '#dce7f2',
    fogColor: '#d7e3ee',
  },
  redstone_oasis: {
    id: 'redstone_oasis',
    name: 'Sunlit Oasis',
    tagline: 'Warm sandstone terraces, canyon arches & spring pools',
    skyTop: '#4c88c4',
    skyHorizon: '#f2dec2',
    fogColor: '#ebd7bc',
  },
  blossom_grove: {
    id: 'blossom_grove',
    name: 'Blossom Grove',
    tagline: 'Sakura plateaus, mossy limestone & lantern paths',
    skyTop: '#6d95cc',
    skyHorizon: '#f1dde6',
    fogColor: '#ead7e0',
  },
};

export interface DimensionPresetMeta {
  id: DimensionId;
  name: string;
  tagline: string;
  skyColor: string;
  fogColor: string;
  seaColor: string;
  portalCoreHex: string;
  portalRimHex: string;
}

export const PORTAL_DESTINATIONS: PortalDestinationId[] = [
  'volcanic',
  'hawaii_beach',
  'dark_dungeon',
];

export const DIMENSION_PRESETS: Record<DimensionId, DimensionPresetMeta> = {
  overworld: {
    id: 'overworld',
    name: 'Overworld Realm',
    tagline: 'Sunlit biomes, villages, and dimensional gateway',
    skyColor: '#a8d5f2',
    fogColor: '#cfe2ee',
    seaColor: '#3b7d9c',
    portalCoreHex: '#8c52ff',
    portalRimHex: '#5ce1e6',
  },
  volcanic: {
    id: 'volcanic',
    name: 'Volcanic Environment',
    tagline: 'Molten lava lakes, basalt spires & ember storms',
    skyColor: '#3d1912',
    fogColor: '#5c2416',
    seaColor: '#e85115',
    portalCoreHex: '#ff6a1a',
    portalRimHex: '#ffd166',
  },
  hawaii_beach: {
    id: 'hawaii_beach',
    name: 'Hawaii Beach',
    tagline: 'Golden sand coves, coconut palms & turquoise reefs',
    skyColor: '#48b8f5',
    fogColor: '#bfe8fa',
    seaColor: '#1ca8c9',
    portalCoreHex: '#1ed6c8',
    portalRimHex: '#ffe066',
  },
  dark_dungeon: {
    id: 'dark_dungeon',
    name: 'Dark Dungeon',
    tagline: 'Ancient crypt halls, obsidian pillars & lantern vaults',
    skyColor: '#0b0d15',
    fogColor: '#111420',
    seaColor: '#10131e',
    portalCoreHex: '#b833ff',
    portalRimHex: '#ff4d6d',
  },
};

export interface WorldConfig {
  seed: number;
  biome: BiomeId;
  dimension?: DimensionId;
  terrainAmplitude: number; // 0.6 to 1.6
  treeDensity: number; // 0.2 to 1.5
  stabilityEnabled: boolean;
}

export interface VillagePlot {
  id: string;
  style: HouseStyle;
  centerX: number;
  baseY: number;
  centerZ: number;
  width: number;
  depth: number;
  height: number;
  label: string;
}

export interface NpcActor {
  id: string;
  name: string;
  role: NpcRole;
  isAnimal: boolean;
  isMonster: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  vy: number;
  yaw: number;
  walkPhase: number;
  state: NpcBehaviorState;
  stateTimer: number;
  targetX: number;
  targetZ: number;
  homeX: number;
  homeZ: number;
  speech: string;
  speechTimer: number;
}

export interface TargetBlockInfo {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  blockId: BlockId;
  integrity: number;
  anchored: boolean;
}

export type WeatherType = 'clear' | 'rainy' | 'snowy' | 'storm';

export interface HudSnapshot {
  playerX: number;
  playerY: number;
  playerZ: number;
  dimension: DimensionId;
  dimensionLabel: string;
  portalPos: { x: number; y: number; z: number };
  nearPortal: boolean;
  currentBiomeLabel: string;
  targetBlock: TargetBlockInfo | null;
  targetNpc: { id: string; name: string; role: NpcRole; state: NpcBehaviorState; speech: string } | null;
  totalPlacedBlocks: number;
  npcCount: number;
  villagerCount: number;
  animalCount: number;
  monsterCount: number;
  shelteringVillagers: number;
  prowlingMonsters: number;
  summonedCount: number;
  villageCount: number;
  houseCount: number;
  flyMode: boolean;
  lastCollapsedCount: number;
  undoCount: number;
  timeOfDay: number; // 0..1
  isDuskOrNight: boolean;
  weather: WeatherType;
  weatherIntensity: number; // 0..1
  weatherAutoCycle: boolean;
  inventory: Record<number, number>;
  totalInventoryCount: number;
  photoMode: boolean;
  dofFocus: number;
  activeBlueprint: BlueprintSummary | null;
  blueprintRotation: 0 | 1 | 2 | 3;
  blueprintCornerA: { x: number; y: number; z: number } | null;
  blueprintCount: number;
  stabilityOverlay: boolean;
}
