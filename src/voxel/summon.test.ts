import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SUMMON_PACK,
  DEFAULT_SUMMON_ROLE,
  SUMMON_ASSETS,
  computeSummonPlacement,
  getAssetsByCategory,
  getSummonAssetDef,
  getSummonCategory,
} from './summon';
import { BlockId } from './types';
import { VoxelGrid } from './voxelGrid';

test('SUMMON_ASSETS includes voxel-art People, Animals, and Monsters and a balanced default pack', () => {
  const people = getAssetsByCategory('people');
  const animals = getAssetsByCategory('animal');
  const monsters = getAssetsByCategory('monster');

  assert.equal(people.length, 3);
  assert.equal(animals.length, 3);
  assert.equal(monsters.length, 3);
  assert.equal(SUMMON_ASSETS.length, 9);

  assert.equal(getSummonCategory(DEFAULT_SUMMON_ROLE), 'monster');
  assert.equal(getSummonAssetDef('golem').label, 'Obsidian Golem');
  assert.equal(getSummonAssetDef('wraith').category, 'monster');

  // Default pack summons People, Animal, and Monsters together
  const packCats = new Set(DEFAULT_SUMMON_PACK.map((r) => getSummonCategory(r)));
  assert.equal(packCats.has('people'), true);
  assert.equal(packCats.has('animal'), true);
  assert.equal(packCats.has('monster'), true);
});

test('computeSummonPlacement positions summoned assets cleanly on ground ahead of player or on targeted block', () => {
  const grid = new VoxelGrid(32, 24, 32);
  for (let x = 0; x < 32; x++) {
    for (let z = 0; z < 32; z++) {
      for (let y = 0; y <= 8; y++) {
        grid.setBlock(x, y, z, y === 8 ? BlockId.Grass : BlockId.Stone, true);
      }
    }
  }

  const player = { x: 16.5, y: 9, z: 18.5, yaw: 0 };
  const p0 = computeSummonPlacement(grid, player, null, 0);
  const p1 = computeSummonPlacement(grid, player, null, 1);
  const p2 = computeSummonPlacement(grid, player, null, 2);

  assert.equal(p0.y, 9);
  assert.ok(p0.z < player.z, 'Yaw 0 faces -Z so summoned asset spawns ahead in -Z');
  assert.notEqual(p1.x, p2.x, 'Multi-asset pack spreads laterally so rigs do not overlap');

  const onBlock = computeSummonPlacement(
    grid,
    player,
    {
      x: 12,
      y: 8,
      z: 14,
      nx: 0,
      ny: 1,
      nz: 0,
      blockId: BlockId.Grass,
      integrity: 100,
      anchored: true,
    },
    0
  );
  assert.equal(onBlock.x, 12.5);
  assert.equal(onBlock.z, 14.5);
  assert.equal(onBlock.y, 9);
});
