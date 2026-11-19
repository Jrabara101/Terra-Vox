import test from 'node:test';
import assert from 'node:assert/strict';
import { BlockId, WorldConfig } from './types';
import { generateProceduralWorld, generateSector } from './worldGen';

test('generateProceduralWorld builds deterministic 3x expanded endless world with open spawn', () => {
  const config: WorldConfig = {
    seed: 1337,
    biome: 'emerald_plains',
    terrainAmplitude: 1.0,
    treeDensity: 1.0,
    stabilityEnabled: true,
  };
  const fixedRng = () => 0.42;
  const worldA = generateProceduralWorld(config, fixedRng);
  const worldB = generateProceduralWorld(config, fixedRng);

  assert.equal(worldA.grid.isEndless, true);
  assert.equal(worldA.grid.getLoadedSectorCount(), 49, 'Initial 3x world should generate 7x7 = 49 sectors (224x224)');
  assert.equal(worldA.grid.countBlocks(), worldB.grid.countBlocks());
  assert.ok(worldA.plots.length >= 2, 'Starter hamlet should contain cottage & watchtower');
  assert.ok(worldA.npcs.length >= 11, 'World should populate villagers, animals, and default monsters');
  assert.ok(worldA.npcs.some((n) => !n.isAnimal && !n.isMonster), 'Expected starter villagers');
  assert.ok(worldA.npcs.some((n) => n.isAnimal), 'Expected starter animals');
  assert.ok(worldA.npcs.some((n) => n.isMonster), 'Expected default starter monsters');

  // Verify default RNG scrambles portal XYZ across calls
  const portals = new Set<string>();
  for (let i = 0; i < 6; i++) {
    const w = generateProceduralWorld(config);
    portals.add(`${w.portal.x},${w.portal.y},${w.portal.z}`);
  }
  assert.ok(portals.size >= 2, 'Expected default world generation to scramble portal XYZ across runs');

  // Verify 3x expanded bounds exist across negative and positive coordinates (-96..127)
  assert.equal(worldA.grid.getBlock(-80, 0, -80), BlockId.Bedrock);
  assert.equal(worldA.grid.getBlock(110, 0, 110), BlockId.Bedrock);
  assert.ok(worldA.grid.getSurfaceY(-80, -80) >= 3);
  assert.ok(worldA.grid.getSurfaceY(110, 110) >= 3);

  // Spawn must be clear (air at player feet & head) and grounded
  const sx = Math.floor(worldA.spawn.x);
  const sy = Math.floor(worldA.spawn.y);
  const sz = Math.floor(worldA.spawn.z);
  assert.equal(worldA.grid.isSolid(sx, sy - 1, sz), true);
  assert.equal(worldA.grid.getBlock(sx, sy, sz), BlockId.Air);
  assert.equal(worldA.grid.getBlock(sx, sy + 1, sz), BlockId.Air);
});

test('alpine_peaks and redstone_oasis produce distinct biome surface blocks', () => {
  const alpine = generateProceduralWorld({
    seed: 42,
    biome: 'alpine_peaks',
    terrainAmplitude: 1.3,
    treeDensity: 0.8,
    stabilityEnabled: true,
  });
  const oasis = generateProceduralWorld({
    seed: 42,
    biome: 'redstone_oasis',
    terrainAmplitude: 1.0,
    treeDensity: 0.6,
    stabilityEnabled: true,
  });

  const snowCount = alpine.grid.countBlocks((id) => id === BlockId.Snow);
  const sandstoneCount = oasis.grid.countBlocks((id) => id === BlockId.Sandstone);

  assert.ok(snowCount > 20, `Expected alpine snow blocks, got ${snowCount}`);
  assert.ok(sandstoneCount > 500, `Expected oasis sandstone blocks, got ${sandstoneCount}`);
});

test('generateSector streams endless frontier sectors seamlessly at distant coordinates', () => {
  const config: WorldConfig = {
    seed: 2048,
    biome: 'mixed',
    terrainAmplitude: 1.0,
    treeDensity: 1.0,
    stabilityEnabled: true,
  };
  const world = generateProceduralWorld(config);
  assert.equal(world.grid.hasGeneratedSector(10, -7), false);

  generateSector(world.grid, 10, -7, config, world.npcs.length);
  assert.equal(world.grid.hasGeneratedSector(10, -7), true);
  assert.equal(world.grid.getLoadedSectorCount(), 50);

  // World coordinates inside sector (10, -7): x in [320..351], z in [-224..-193]
  assert.equal(world.grid.getBlock(335, 0, -210), BlockId.Bedrock);
  const surfY = world.grid.getSurfaceY(335, -210, false);
  assert.ok(surfY >= 3 && surfY < world.grid.sizeY);
});
