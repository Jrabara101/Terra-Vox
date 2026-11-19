import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureBlueprintRegion,
  captureNearestPlotBlueprint,
  getRotatedDimensions,
  loadBlueprints,
  rotateBlueprintBlock,
  saveBlueprints,
  stampBlueprint,
  toBlueprintSummary,
} from './blueprints';
import { StorageLike } from './inventory';
import { buildProceduralHouse } from './structures';
import { BlockId, HOTBAR_PAGES } from './types';
import { VoxelGrid } from './voxelGrid';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

test('captureNearestPlotBlueprint, rotate, and stampBlueprint reproduce house cleanly with undoable changes', () => {
  const grid = new VoxelGrid(48, 28, 48);
  for (let x = 0; x < 48; x++) {
    for (let z = 0; z < 48; z++) {
      for (let y = 0; y <= 8; y++) {
        grid.setBlock(x, y, z, y === 8 ? BlockId.Grass : BlockId.Stone, true);
      }
    }
  }

  const built = buildProceduralHouse(grid, 16, 16, 'cottage', 99, 'Hearth Cottage');
  const bp = captureNearestPlotBlueprint(grid, [built.plot], 16, 16, 'My Hearth Cottage');
  assert.ok(bp, 'Expected house blueprint to be captured');
  assert.equal(bp.name, 'My Hearth Cottage');
  assert.ok(bp.blocks.length >= 40, 'House blueprint should capture all structural blocks');

  const summary = toBlueprintSummary(bp);
  assert.equal(summary.blockCount, bp.blocks.length);

  // Verify 90° rotation swaps width & depth
  const rot90 = getRotatedDimensions(bp, 1);
  assert.equal(rot90.width, bp.depth);
  assert.equal(rot90.depth, bp.width);
  assert.deepEqual(rotateBlueprintBlock(3, -1, 1), { dx: 1, dz: 3 });
  assert.deepEqual(rotateBlueprintBlock(3, -1, 4), { dx: 3, dz: -1 });

  // Stamp rotated 90° onto a clean site elsewhere in the grid
  const stamped = stampBlueprint(grid, bp, 34, 9, 34, 1);
  assert.ok(stamped.placedCount >= 40);
  assert.equal(stamped.batch.length, stamped.placedCount);

  // Reversing the returned BlockChange batch cleanly restores the site
  for (let i = stamped.batch.length - 1; i >= 0; i--) {
    const ch = stamped.batch[i];
    grid.setBlock(ch.x, ch.y, ch.z, ch.prevId, ch.prevAnchored);
  }
  for (const ch of stamped.batch) {
    assert.equal(grid.getBlock(ch.x, ch.y, ch.z), ch.prevId);
  }
});

test('captureBlueprintRegion captures custom voxel edits and persists via storage', () => {
  const grid = new VoxelGrid(24, 20, 24);
  grid.setBlock(5, 4, 5, BlockId.Basalt, true);
  grid.setBlock(6, 4, 5, BlockId.Magma, true);
  grid.setBlock(5, 5, 5, BlockId.DungeonBrick, false);
  grid.setBlock(6, 5, 5, BlockId.Coral, false);

  const customBp = captureBlueprintRegion(
    grid,
    { x: 5, y: 4, z: 5 },
    { x: 6, y: 5, z: 5 },
    'Realm Shrine'
  );
  assert.ok(customBp);
  assert.equal(customBp.blocks.length, 4);
  assert.equal(customBp.width, 2);
  assert.equal(customBp.height, 2);

  const storage = createMemoryStorage();
  saveBlueprints([customBp], storage);
  const loaded = loadBlueprints(storage);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].name, 'Realm Shrine');
  assert.equal(loaded[0].blocks.length, 4);
});

test('HOTBAR_PAGES Realms page exposes all 7 dimension blocks', () => {
  const realmsPage = HOTBAR_PAGES[1];
  assert.equal(realmsPage.label, 'Realms');
  const expectedDimensionBlocks = [
    BlockId.Basalt,
    BlockId.Magma,
    BlockId.BeachSand,
    BlockId.PalmWood,
    BlockId.Coral,
    BlockId.DungeonBrick,
    BlockId.DungeonSlate,
  ];
  for (const blockId of expectedDimensionBlocks) {
    assert.ok(
      realmsPage.blocks.includes(blockId),
      `Expected Realms hotbar page to include BlockId ${blockId}`
    );
  }
});
