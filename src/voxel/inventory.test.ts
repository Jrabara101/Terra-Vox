import test from 'node:test';
import assert from 'node:assert/strict';
import { BlockId } from './types';
import {
  INVENTORY_STORAGE_KEY,
  StorageLike,
  addResourceToInventory,
  consumeResourceFromInventory,
  createStarterInventory,
  getResourceCount,
  getTotalResourceCount,
  isCollectibleBlock,
  loadPersistentInventory,
  resetPersistentInventory,
  revertBatchInInventory,
  savePersistentInventory,
} from './inventory';

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

test('createStarterInventory initializes finite supplies with empty kiln materials', () => {
  const inv = createStarterInventory();
  assert.equal(getResourceCount(inv, BlockId.OakPlanks), 16);
  assert.equal(getResourceCount(inv, BlockId.Brick), 0);
  assert.equal(getResourceCount(inv, BlockId.RoofShingle), 0);
  assert.ok(getTotalResourceCount(inv) > 0);
});

test('isCollectibleBlock filters Air, Bedrock, and Water', () => {
  assert.equal(isCollectibleBlock(BlockId.Air), false);
  assert.equal(isCollectibleBlock(BlockId.Bedrock), false);
  assert.equal(isCollectibleBlock(BlockId.Water), false);
  assert.equal(isCollectibleBlock(BlockId.Stone), true);
  assert.equal(isCollectibleBlock(BlockId.GoldOre), true);
});

test('addResourceToInventory increments collectible blocks and ignores non-collectibles', () => {
  let inv = createStarterInventory();
  const baseBrick = getResourceCount(inv, BlockId.Brick);
  inv = addResourceToInventory(inv, BlockId.Brick, 3);
  assert.equal(getResourceCount(inv, BlockId.Brick), baseBrick + 3);

  const unchanged = addResourceToInventory(inv, BlockId.Water, 5);
  assert.equal(getResourceCount(unchanged, BlockId.Water), 0);
});

test('consumeResourceFromInventory never drops below zero and caps partial consumption', () => {
  const inv = createStarterInventory();
  const emptyRes = consumeResourceFromInventory(inv, BlockId.Brick, 1);
  assert.equal(emptyRes.consumed, 0);
  assert.equal(getResourceCount(emptyRes.next, BlockId.Brick), 0);

  const partial = consumeResourceFromInventory(inv, BlockId.Lantern, 5);
  assert.equal(partial.consumed, 2);
  assert.equal(getResourceCount(partial.next, BlockId.Lantern), 0);
});

test('revertBatchInInventory symmetrically refunds placed blocks and deducts mined blocks', () => {
  let inv = createStarterInventory();
  // Simulate mining 1 Stone and placing 1 OakPlanks
  inv = addResourceToInventory(inv, BlockId.Stone, 1);
  inv = consumeResourceFromInventory(inv, BlockId.OakPlanks, 1).next;
  assert.equal(getResourceCount(inv, BlockId.Stone), 9);
  assert.equal(getResourceCount(inv, BlockId.OakPlanks), 15);

  const reverted = revertBatchInInventory(inv, [
    { prevId: BlockId.Stone, nextId: BlockId.Air },
    { prevId: BlockId.Air, nextId: BlockId.OakPlanks },
  ]);
  assert.equal(getResourceCount(reverted, BlockId.Stone), 8);
  assert.equal(getResourceCount(reverted, BlockId.OakPlanks), 16);
});

test('loadPersistentInventory and savePersistentInventory persist updates across sessions', () => {
  const store = new MemoryStorage();
  const initial = loadPersistentInventory(store);
  assert.equal(getResourceCount(initial, BlockId.OakPlanks), 16);
  assert.ok(store.getItem(INVENTORY_STORAGE_KEY));

  const afterMine = addResourceToInventory(
    consumeResourceFromInventory(initial, BlockId.OakPlanks, 4).next,
    BlockId.Dirt,
    7
  );
  savePersistentInventory(afterMine, store);

  const reloaded = loadPersistentInventory(store);
  assert.equal(getResourceCount(reloaded, BlockId.OakPlanks), 12);
  assert.equal(getResourceCount(reloaded, BlockId.Dirt), 7);

  const reset = resetPersistentInventory(store);
  assert.equal(getResourceCount(reset, BlockId.OakPlanks), 16);
  assert.equal(getResourceCount(reset, BlockId.Dirt), 0);
});
