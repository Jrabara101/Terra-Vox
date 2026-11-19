import { BLOCK_DEFS, BlockId } from './types';

export const INVENTORY_STORAGE_KEY = 'terravox_inventory_v1';

export type InventoryCounts = Record<number, number>;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export const STARTER_INVENTORY: InventoryCounts = {
  [BlockId.Grass]: 8,
  [BlockId.Stone]: 8,
  [BlockId.Cobblestone]: 10,
  [BlockId.OakLog]: 6,
  [BlockId.OakPlanks]: 16,
  [BlockId.Brick]: 0,
  [BlockId.RoofShingle]: 0,
  [BlockId.Glass]: 4,
  [BlockId.Lantern]: 2,
};

export function createStarterInventory(): InventoryCounts {
  return { ...STARTER_INVENTORY };
}

export function isCollectibleBlock(blockId: BlockId): boolean {
  return (
    blockId !== BlockId.Air &&
    blockId !== BlockId.Bedrock &&
    blockId !== BlockId.Water &&
    blockId !== BlockId.Lava &&
    blockId !== BlockId.PortalStone &&
    Boolean(BLOCK_DEFS[blockId]?.solid)
  );
}

export function getResourceCount(inventory: InventoryCounts, blockId: BlockId): number {
  const val = inventory[blockId];
  return typeof val === 'number' && Number.isFinite(val) && val > 0 ? Math.floor(val) : 0;
}

export function getTotalResourceCount(inventory: InventoryCounts): number {
  let total = 0;
  for (const key of Object.keys(inventory)) {
    const val = inventory[Number(key)];
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
      total += Math.floor(val);
    }
  }
  return total;
}

export function addResourceToInventory(
  inventory: InventoryCounts,
  blockId: BlockId,
  amount = 1
): InventoryCounts {
  if (!isCollectibleBlock(blockId) || amount <= 0) return inventory;
  const current = getResourceCount(inventory, blockId);
  return {
    ...inventory,
    [blockId]: current + Math.floor(amount),
  };
}

export function consumeResourceFromInventory(
  inventory: InventoryCounts,
  blockId: BlockId,
  amount = 1
): { next: InventoryCounts; consumed: number } {
  if (!isCollectibleBlock(blockId) || amount <= 0) {
    return { next: inventory, consumed: 0 };
  }
  const available = getResourceCount(inventory, blockId);
  const want = Math.floor(amount);
  const consumed = Math.min(available, want);
  if (consumed <= 0) {
    return { next: inventory, consumed: 0 };
  }
  return {
    next: {
      ...inventory,
      [blockId]: available - consumed,
    },
    consumed,
  };
}

export interface BatchInventoryDelta {
  prevId: BlockId;
  nextId: BlockId;
}

/**
 * Reverses a block change batch in inventory during Undo:
 * placed blocks (nextId) are refunded, mined/overwritten blocks (prevId) are deducted.
 */
export function revertBatchInInventory(
  inventory: InventoryCounts,
  batch: BatchInventoryDelta[]
): InventoryCounts {
  let next = { ...inventory };
  for (const c of batch) {
    if (isCollectibleBlock(c.nextId)) {
      next = addResourceToInventory(next, c.nextId, 1);
    }
    if (isCollectibleBlock(c.prevId)) {
      next = consumeResourceFromInventory(next, c.prevId, 1).next;
    }
  }
  return next;
}

export function sanitizeInventory(raw: unknown): InventoryCounts {
  if (!raw || typeof raw !== 'object') {
    return createStarterInventory();
  }
  const result: InventoryCounts = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(k) as BlockId;
    if (!isCollectibleBlock(id)) continue;
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      result[id] = Math.floor(v);
    }
  }
  return result;
}

function getDefaultStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

export function loadPersistentInventory(storage?: StorageLike | null): InventoryCounts {
  const store = storage === undefined ? getDefaultStorage() : storage;
  if (!store) return createStarterInventory();
  try {
    const raw = store.getItem(INVENTORY_STORAGE_KEY);
    if (!raw) {
      const starter = createStarterInventory();
      store.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(starter));
      return starter;
    }
    const parsed = JSON.parse(raw);
    return sanitizeInventory(parsed);
  } catch {
    return createStarterInventory();
  }
}

export function savePersistentInventory(
  inventory: InventoryCounts,
  storage?: StorageLike | null
): void {
  const store = storage === undefined ? getDefaultStorage() : storage;
  if (!store) return;
  try {
    store.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventory));
  } catch {
    // Ignore quota or private mode storage failures gracefully
  }
}

export function resetPersistentInventory(storage?: StorageLike | null): InventoryCounts {
  const starter = createStarterInventory();
  savePersistentInventory(starter, storage);
  return starter;
}
