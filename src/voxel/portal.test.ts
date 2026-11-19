import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHugePortalStructure,
  clearHugePortalStructure,
  isPlayerInsidePortal,
  isPlayerNearPortal,
  pickRandomPortalDestination,
  scramblePortalPosition,
} from './portal';
import { BlockId, PORTAL_DESTINATIONS, WorldConfig } from './types';
import { generateProceduralWorld } from './worldGen';

function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('pickRandomPortalDestination picks among Volcanic, Hawaii Beach, and Dark Dungeon', () => {
  const seen = new Set<string>();
  const rng = makeSeededRng(101);
  for (let i = 0; i < 40; i++) {
    const dest = pickRandomPortalDestination('overworld', rng);
    assert.ok(PORTAL_DESTINATIONS.includes(dest));
    seen.add(dest);
  }
  assert.equal(seen.size, 3, 'Should cover all 3 random portal destinations');

  for (const current of PORTAL_DESTINATIONS) {
    for (let i = 0; i < 15; i++) {
      const next = pickRandomPortalDestination(current, rng);
      assert.notEqual(next, current, 'Random teleport should rotate to another dimension');
    }
  }
});

test('scramblePortalPosition places portal at varied dry XYZ coordinates and builds 9x11 archway', () => {
  const config: WorldConfig = {
    seed: 2048,
    biome: 'mixed',
    terrainAmplitude: 1.0,
    treeDensity: 1.0,
    stabilityEnabled: true,
  };
  const world = generateProceduralWorld(config, makeSeededRng(7));

  // Verify the huge portal was built in the grid
  const portalBlocks = world.grid.countBlocks((id) => id === BlockId.PortalStone);
  assert.ok(portalBlocks >= 65, `Expected huge portal frame (>= 65 PortalStone blocks), got ${portalBlocks}`);

  // Portal aperture center must be clear (air) so the player can walk straight inside
  assert.equal(world.grid.getBlock(world.portal.x, world.portal.y, world.portal.z), BlockId.Air);
  assert.equal(world.grid.getBlock(world.portal.x, world.portal.y + 3, world.portal.z), BlockId.Air);

  // Scrambling multiple times produces distinct XYZ coordinates
  const p1 = scramblePortalPosition(
    world.grid,
    world.spawn.x,
    world.spawn.z,
    world.plots,
    world.portal,
    makeSeededRng(123)
  );
  const p2 = scramblePortalPosition(
    world.grid,
    world.spawn.x,
    world.spawn.z,
    world.plots,
    p1,
    makeSeededRng(987)
  );
  assert.ok(p1.x !== p2.x || p1.z !== p2.z, 'Scrambled positions should relocate portal XYZ');

  // Clear old & build new huge portal cleanly
  clearHugePortalStructure(world.grid, world.portal.x, world.portal.y, world.portal.z, BlockId.Grass);
  buildHugePortalStructure(world.grid, p1.x, p1.y, p1.z, BlockId.Cobblestone);

  assert.equal(
    isPlayerInsidePortal({ x: p1.x + 0.5, y: p1.y + 0.5, z: p1.z + 0.5 }, p1),
    true
  );
  assert.equal(
    isPlayerInsidePortal({ x: p1.x + 6, y: p1.y + 0.5, z: p1.z + 0.5 }, p1),
    false
  );
  assert.equal(
    isPlayerNearPortal({ x: p1.x + 5, y: p1.y, z: p1.z + 0.5 }, p1),
    true
  );
});

test('all 3 dimensional teleport destinations generate distinct terrain, ceiling cutoffs, and valid spawns', () => {
  const base: WorldConfig = {
    seed: 5150,
    biome: 'mixed',
    terrainAmplitude: 1.0,
    treeDensity: 1.0,
    stabilityEnabled: true,
  };

  // 1. Volcanic Environment
  const volcanic = generateProceduralWorld({ ...base, dimension: 'volcanic' }, makeSeededRng(11));
  assert.ok(volcanic.grid.countBlocks((id) => id === BlockId.Basalt) > 2000);
  assert.ok(volcanic.grid.countBlocks((id) => id === BlockId.Lava) > 100);
  assert.ok(volcanic.grid.countBlocks((id) => id === BlockId.Magma) > 40);
  assert.ok(volcanic.grid.countBlocks((id) => id === BlockId.PortalStone) >= 65);
  assert.equal(
    volcanic.grid.getBlock(Math.floor(volcanic.spawn.x), Math.floor(volcanic.spawn.y), Math.floor(volcanic.spawn.z)),
    BlockId.Air
  );

  // 2. Hawaii Beach
  const hawaii = generateProceduralWorld({ ...base, dimension: 'hawaii_beach' }, makeSeededRng(22));
  assert.ok(hawaii.grid.countBlocks((id) => id === BlockId.BeachSand) > 2000);
  assert.ok(hawaii.grid.countBlocks((id) => id === BlockId.PalmWood) > 15);
  assert.ok(hawaii.grid.countBlocks((id) => id === BlockId.PalmLeaves) > 40);
  assert.ok(hawaii.grid.countBlocks((id) => id === BlockId.Coral) > 10);
  assert.ok(hawaii.grid.countBlocks((id) => id === BlockId.PortalStone) >= 65);
  assert.equal(
    hawaii.grid.getBlock(Math.floor(hawaii.spawn.x), Math.floor(hawaii.spawn.y), Math.floor(hawaii.spawn.z)),
    BlockId.Air
  );

  // 3. Dark Dungeon
  const dungeon = generateProceduralWorld({ ...base, dimension: 'dark_dungeon' }, makeSeededRng(33));
  assert.equal(dungeon.grid.ceilingCutoffY, 21);
  assert.ok(dungeon.grid.countBlocks((id) => id === BlockId.DungeonBrick) > 2000);
  assert.ok(dungeon.grid.countBlocks((id) => id === BlockId.DungeonSlate) > 500);
  assert.ok(dungeon.grid.countBlocks((id) => id === BlockId.PortalStone) >= 65);
  assert.ok(dungeon.spawn.y <= 19, 'Dungeon player spawn must sit under the vaulted ceiling');
  assert.equal(
    dungeon.grid.getBlock(Math.floor(dungeon.spawn.x), Math.floor(dungeon.spawn.y), Math.floor(dungeon.spawn.z)),
    BlockId.Air
  );
});
