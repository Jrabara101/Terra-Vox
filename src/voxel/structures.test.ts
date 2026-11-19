import test from 'node:test';
import assert from 'node:assert/strict';
import { solveStructuralStability } from './stability';
import { buildProceduralHouse, expandVillage } from './structures';
import { BlockId } from './types';
import { VoxelGrid } from './voxelGrid';

test('buildProceduralHouse creates grounded structure with framed doorway and passes stability', () => {
  const grid = new VoxelGrid(40, 28, 40);
  for (let x = 0; x < 40; x++) {
    for (let z = 0; z < 40; z++) {
      for (let y = 0; y <= 8; y++) {
        grid.setBlock(x, y, z, y === 8 ? BlockId.Grass : BlockId.Stone, true);
      }
    }
  }

  const res = buildProceduralHouse(grid, 20, 20, 'cottage', 99);
  assert.ok(res.placedCount > 60, 'House should place substantial modular blocks');

  // Doorway clearance at baseY and baseY + 1
  const doorBlock = grid.getBlock(res.doorX, res.doorY, res.plot.centerZ + 3);
  assert.equal(doorBlock, BlockId.Air, 'Doorway should be open for entry');

  // Structural stability check: cottage should be structurally sound!
  const stability = solveStructuralStability(grid);
  assert.equal(
    stability.unstableBlocks.length,
    0,
    `Generated cottage should have 0 unstable blocks, found ${stability.unstableBlocks.length}`
  );
});

test('expandVillage builds multiple non-overlapping plots, paths, and spawns villagers', () => {
  const grid = new VoxelGrid(72, 36, 72);
  for (let x = 0; x < 72; x++) {
    for (let z = 0; z < 72; z++) {
      for (let y = 0; y <= 9; y++) {
        grid.setBlock(x, y, z, y === 9 ? BlockId.Grass : BlockId.Stone, true);
      }
    }
  }

  const expansion = expandVillage(grid, 36, 36, [], 55);
  assert.ok(expansion.plots.length >= 3, 'Village expansion should build at least 3 buildings');
  assert.ok(expansion.newNpcSpawns.length >= 3, 'Village expansion should spawn villagers');
  assert.ok(expansion.placedBlocks > 250);

  const stability = solveStructuralStability(grid);
  assert.equal(
    stability.unstableBlocks.length,
    0,
    `Expanded village buildings should be structurally stable, found ${stability.unstableBlocks.length} unstable blocks`
  );
});
