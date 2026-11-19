import { NpcRole, SummonCategory, TargetBlockInfo } from './types';
import { VoxelGrid } from './voxelGrid';

export interface SummonAssetDef {
  role: NpcRole;
  category: SummonCategory;
  label: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  eyeColor: string;
}

export const SUMMON_ASSETS: SummonAssetDef[] = [
  // People
  {
    role: 'mason',
    category: 'people',
    label: 'Stone Mason',
    tagline: 'Builds & inspects load-bearing masonry',
    primaryColor: '#3b6e8c',
    accentColor: '#d98c2b',
    eyeColor: '#1b222c',
  },
  {
    role: 'farmer',
    category: 'people',
    label: 'Meadow Farmer',
    tagline: 'Tends village fields & herds',
    primaryColor: '#5c8c42',
    accentColor: '#e5c158',
    eyeColor: '#1b222c',
  },
  {
    role: 'ranger',
    category: 'people',
    label: 'Lantern Ranger',
    tagline: 'Patrols biome trails with glowing staff',
    primaryColor: '#456348',
    accentColor: '#9c3d32',
    eyeColor: '#ffd166',
  },
  // Animals
  {
    role: 'sheep',
    category: 'animal',
    label: 'Meadow Sheep',
    tagline: 'Fluffy wool grazer of open plains',
    primaryColor: '#f4efe6',
    accentColor: '#3b3532',
    eyeColor: '#1a1a1a',
  },
  {
    role: 'fox',
    category: 'animal',
    label: 'Woodland Fox',
    tagline: 'Swift amber forest runner',
    primaryColor: '#d96b27',
    accentColor: '#f6ede0',
    eyeColor: '#1e1a18',
  },
  {
    role: 'songbird',
    category: 'animal',
    label: 'Sky Songbird',
    tagline: 'Azure flyer gliding above rooftops',
    primaryColor: '#3b8ec2',
    accentColor: '#f4c552',
    eyeColor: '#211c17',
  },
  // Monsters
  {
    role: 'slime',
    category: 'monster',
    label: 'Moss Slime',
    tagline: 'Bouncing emerald cube with glowing core',
    primaryColor: '#52c465',
    accentColor: '#236e36',
    eyeColor: '#d9ff70',
  },
  {
    role: 'golem',
    category: 'monster',
    label: 'Obsidian Golem',
    tagline: 'Heavy stone sentinel with amber rune heart',
    primaryColor: '#424754',
    accentColor: '#ff9f2e',
    eyeColor: '#ffc857',
  },
  {
    role: 'wraith',
    category: 'monster',
    label: 'Storm Wraith',
    tagline: 'Hovering horned spirit with violet gaze',
    primaryColor: '#312b4d',
    accentColor: '#8d6eff',
    eyeColor: '#5ce1e6',
  },
];

export const DEFAULT_SUMMON_ROLE: NpcRole = 'slime';

/**
 * Default pack summoned in one click or seeded across the starter meadow/frontier:
 * includes a Person, an Animal, and Monsters based on voxel art assets.
 */
export const DEFAULT_SUMMON_PACK: NpcRole[] = ['ranger', 'fox', 'slime', 'golem'];

export function getSummonCategory(role: NpcRole): SummonCategory {
  if (role === 'sheep' || role === 'fox' || role === 'songbird') return 'animal';
  if (role === 'slime' || role === 'golem' || role === 'wraith') return 'monster';
  return 'people';
}

export function getSummonAssetDef(role: NpcRole): SummonAssetDef {
  return SUMMON_ASSETS.find((a) => a.role === role) ?? SUMMON_ASSETS[0];
}

export function getAssetsByCategory(category: SummonCategory): SummonAssetDef[] {
  return SUMMON_ASSETS.filter((a) => a.category === category);
}

export function computeSummonPlacement(
  grid: VoxelGrid,
  player: { x: number; y: number; z: number; yaw: number },
  targetBlock: TargetBlockInfo | null,
  slotIndex = 0
): { x: number; y: number; z: number; yaw: number } {
  const sinY = Math.sin(player.yaw);
  const cosY = Math.cos(player.yaw);

  // Arc spread when summoning multiple default assets simultaneously
  const arcOffsets = [0, -1.8, 1.8, -3.2, 3.2];
  const lateral = arcOffsets[slotIndex % arcOffsets.length] ?? 0;
  const forwardDist = 4.2 + Math.floor(slotIndex / 3) * 1.6;

  let baseX: number;
  let baseZ: number;
  if (targetBlock && slotIndex === 0) {
    baseX = targetBlock.x + targetBlock.nx + 0.5;
    baseZ = targetBlock.z + targetBlock.nz + 0.5;
  } else {
    baseX = player.x - sinY * forwardDist + cosY * lateral;
    baseZ = player.z - cosY * forwardDist - sinY * lateral;
  }

  const clampedX = grid.isEndless
    ? baseX
    : Math.max(2.5, Math.min(grid.sizeX - 2.5, baseX));
  const clampedZ = grid.isEndless
    ? baseZ
    : Math.max(2.5, Math.min(grid.sizeZ - 2.5, baseZ));

  const gx = Math.floor(clampedX);
  const gz = Math.floor(clampedZ);
  const surfaceY = grid.getSurfaceY(gx, gz, false);
  const spawnY =
    targetBlock && slotIndex === 0
      ? Math.max(surfaceY, targetBlock.y + targetBlock.ny)
      : surfaceY;

  const faceYaw = Math.atan2(player.x - clampedX, player.z - clampedZ);

  return {
    x: clampedX,
    y: spawnY,
    z: clampedZ,
    yaw: faceYaw,
  };
}
