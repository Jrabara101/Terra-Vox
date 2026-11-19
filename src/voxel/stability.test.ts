import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collapseUnstableBlocks,
  computeBlockInstanceTint,
  solveStructuralStability,
} from './stability';
import { BlockId } from './types';
import { VoxelGrid } from './voxelGrid';

test('anchored pillars support vertical stacks and limited cantilevers', () => {
  const grid = new VoxelGrid(16, 16, 16);
  // Ground anchor slab at y=1
  for (let x = 2; x <= 12; x++) {
    grid.setBlock(x, 1, 5, BlockId.Stone, true);
  }
  // Vertical OakLog column up to y=5
  for (let y = 2; y <= 5; y++) {
    grid.setBlock(3, y, 5, BlockId.OakLog, false);
  }
  // Cantilever OakPlanks 2 blocks out (within maxCantilever=4)
  grid.setBlock(4, 5, 5, BlockId.OakPlanks, false);
  grid.setBlock(5, 5, 5, BlockId.OakPlanks, false);

  const report = solveStructuralStability(grid);
  assert.equal(report.unstableBlocks.length, 0);
  assert.ok(grid.getIntegrity(5, 5, 5) > 0);
});

test('floating blocks and severed cantilevers collapse under stability physics', () => {
  const grid = new VoxelGrid(16, 16, 16);
  grid.setBlock(4, 1, 4, BlockId.Stone, true);

  // Floating stone block with no connection to ground
  grid.setBlock(10, 8, 10, BlockId.Stone, false);

  // Over-extended stone cantilever (5 blocks out > Stone maxCantilever 2)
  grid.setBlock(4, 2, 4, BlockId.Stone, false);
  grid.setBlock(4, 3, 4, BlockId.Stone, false);
  for (let dx = 1; dx <= 6; dx++) {
    grid.setBlock(4 + dx, 3, 4, BlockId.Stone, false);
  }

  const collapsed = collapseUnstableBlocks(grid);
  assert.ok(collapsed.some((b) => b.x === 10 && b.y === 8 && b.z === 10), 'Floating block should collapse');
  assert.ok(collapsed.some((b) => b.x === 10 && b.y === 3 && b.z === 4), 'Far end of stone cantilever should collapse');
  assert.equal(grid.getBlock(10, 8, 10), BlockId.Air);
});

test('endless VoxelGrid solves local stability and collapses floating blocks at far negative/positive coordinates', () => {
  const grid = VoxelGrid.createEndless(36);
  for (let x = -246; x <= -234; x++) {
    for (let z = 404; z <= 416; z++) {
      grid.setBlock(x, 1, z, BlockId.Stone, true);
    }
  }
  grid.setBlock(-240, 2, 410, BlockId.OakLog, false);
  grid.setBlock(-240, 3, 410, BlockId.OakPlanks, false);
  // Floating unsupported block
  grid.setBlock(-238, 10, 412, BlockId.Stone, false);

  const collapsed = collapseUnstableBlocks(grid, -240, 410, 16);
  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0].x, -238);
  assert.equal(collapsed[0].y, 10);
  assert.equal(collapsed[0].z, 412);
  assert.ok(grid.getIntegrity(-240, 3, 410) > 0);
});

test('computeBlockInstanceTint uses neutral default block colors unless heatmap overlay is active', () => {
  const defTint = computeBlockInstanceTint(12, 10, 18, false, 100, false);
  assert.equal(defTint.mode, 'neutral');
  if (defTint.mode === 'neutral') {
    assert.ok(defTint.tint >= 0.94 && defTint.tint <= 1.06);
  }

  const heatmapHigh = computeBlockInstanceTint(12, 10, 18, false, 95, true);
  assert.deepEqual(heatmapHigh, { mode: 'heatmap', hex: '#38d97c' });

  const heatmapMed = computeBlockInstanceTint(12, 10, 18, false, 55, true);
  assert.deepEqual(heatmapMed, { mode: 'heatmap', hex: '#f5b041' });
});
