import test from 'node:test';
import assert from 'node:assert/strict';
import { interactWithNpc, isDuskOrNightTime, stepNpcActor } from './npcAI';
import { BlockId } from './types';
import { VoxelGrid } from './voxelGrid';
import { createNpcActor } from './worldGen';

test('stepNpcActor moves villagers, makes animals flee sprinting player, and keeps birds soaring', () => {
  const grid = new VoxelGrid(32, 24, 32);
  for (let x = 0; x < 32; x++) {
    for (let z = 0; z < 32; z++) {
      for (let y = 0; y <= 8; y++) {
        grid.setBlock(x, y, z, y === 8 ? BlockId.Grass : BlockId.Stone, true);
      }
    }
  }

  const sheep = createNpcActor('sheep', 16, 9, 16, 0, 1);
  const mason = createNpcActor('mason', 10, 9, 10, 1, 1);
  const bird = createNpcActor('songbird', 16, 15, 16, 2, 1);
  const actors = [sheep, mason, bird];

  // Sprinting player right next to sheep triggers flee state
  stepNpcActor(sheep, grid, actors, { x: 17, y: 9, z: 16 }, true, [], 0.1, 0.3, 1);
  assert.equal(sheep.state, 'flee');

  // Bird stays soaring above ground
  const prevBirdX = bird.x;
  stepNpcActor(bird, grid, actors, { x: 17, y: 9, z: 16 }, false, [], 0.25, 0.3, 2);
  assert.equal(bird.state, 'soar');
  assert.notEqual(bird.x, prevBirdX);

  // Villager interaction sets speech
  const line = interactWithNpc(mason, 3);
  assert.ok(line.includes(mason.name));
  assert.ok(mason.speechTimer > 0);
});

test('stepNpcActor adapts villager, songbird, and dialogue behavior to rainy and snowy weather', () => {
  const grid = new VoxelGrid(40, 24, 40);
  for (let x = 0; x < 40; x++) {
    for (let z = 0; z < 40; z++) {
      for (let y = 0; y <= 8; y++) {
        grid.setBlock(x, y, z, y === 8 ? BlockId.Grass : BlockId.Stone, true);
      }
    }
  }

  const plot = {
    id: 'plot_1',
    style: 'cottage' as const,
    centerX: 25,
    baseY: 9,
    centerZ: 25,
    width: 7,
    depth: 7,
    height: 6,
    label: 'Cottage',
  };

  const villager = createNpcActor('farmer', 10, 9, 10, 0, 1);
  const birdClear = createNpcActor('songbird', 20, 16, 20, 1, 1);
  const birdRain = createNpcActor('songbird', 20, 16, 20, 2, 1);
  const actors = [villager, birdClear, birdRain];

  // Rainy weather prompts distant villager to seek nearest shelter plot
  stepNpcActor(villager, grid, actors, { x: 2, y: 9, z: 2 }, false, [plot], 0.1, 0.3, 5, 'rainy');
  assert.equal(villager.state, 'seek_shelter');
  assert.equal(villager.targetX, plot.centerX + 0.5);
  assert.equal(villager.targetZ, plot.centerZ + 0.5);

  // Songbird flies lower during rain than during clear skies
  for (let i = 0; i < 20; i++) {
    stepNpcActor(birdClear, grid, actors, { x: 2, y: 9, z: 2 }, false, [plot], 0.1, 0.3, i, 'clear');
    stepNpcActor(birdRain, grid, actors, { x: 2, y: 9, z: 2 }, false, [plot], 0.1, 0.3, i, 'rainy');
  }
  assert.ok(birdRain.y < birdClear.y);

  // Weather-specific interaction dialogue
  const snowLine = interactWithNpc(villager, 7, 'snowy');
  assert.ok(/snow|powder|warm/i.test(snowLine));

  // Thunderstorm shelter seeking & thunder dialogue
  const stormVillager = createNpcActor('mason', 8, 9, 8, 9, 1);
  stepNpcActor(stormVillager, grid, actors, { x: 2, y: 9, z: 2 }, false, [plot], 0.1, 0.3, 12, 'storm');
  assert.equal(stormVillager.state, 'seek_shelter');
  const stormLine = interactWithNpc(stormVillager, 13, 'storm');
  assert.ok(/thunder|storm|roof|lightning|beams/i.test(stormLine));
});

test('stepNpcActor drives monster prowl, wraith hover, and weather dialogue without fleeing', () => {
  const grid = new VoxelGrid(40, 24, 40);
  for (let x = 0; x < 40; x++) {
    for (let z = 0; z < 40; z++) {
      for (let y = 0; y <= 8; y++) {
        grid.setBlock(x, y, z, y === 8 ? BlockId.Grass : BlockId.Stone, true);
      }
    }
  }

  const slime = createNpcActor('slime', 20, 9, 20, 1, 7);
  const golem = createNpcActor('golem', 14, 9, 14, 2, 7);
  const wraith = createNpcActor('wraith', 22, 9, 22, 3, 7);
  assert.equal(slime.isMonster, true);
  assert.equal(wraith.state, 'hover');

  const actors = [slime, golem, wraith];
  slime.stateTimer = 0.05;
  stepNpcActor(slime, grid, actors, { x: 26, y: 9, z: 20 }, true, [], 0.1, 0.3, 15, 'clear');
  assert.equal(slime.state, 'prowl');

  const prevWraithX = wraith.x;
  stepNpcActor(wraith, grid, actors, { x: 26, y: 9, z: 20 }, false, [], 0.25, 0.3, 16, 'storm');
  assert.equal(wraith.state, 'hover');
  assert.ok(wraith.y > 9.5, 'Storm wraith should hover smoothly above ground');
  assert.notEqual(wraith.x, prevWraithX);

  const golemLine = interactWithNpc(golem, 4, 'storm');
  assert.ok(golemLine.includes(golem.name));
  assert.ok(/obsidian|gale/i.test(golemLine));
});

test('Day/Night NPC schedules send villagers to lantern-lit cottages and boost nocturnal monster activity', () => {
  assert.equal(isDuskOrNightTime(0.28), false);
  assert.equal(isDuskOrNightTime(0.78), true);
  assert.equal(isDuskOrNightTime(0.1), true);

  const grid = new VoxelGrid(48, 24, 48);
  for (let x = 0; x < 48; x++) {
    for (let z = 0; z < 48; z++) {
      for (let y = 0; y <= 8; y++) {
        grid.setBlock(x, y, z, y === 8 ? BlockId.Grass : BlockId.Stone, true);
      }
    }
  }

  const plot = {
    id: 'lantern_cottage',
    style: 'cottage' as const,
    centerX: 28,
    baseY: 9,
    centerZ: 28,
    width: 7,
    depth: 7,
    height: 6,
    label: 'Lantern Cottage',
  };
  // Place a literal porch lantern block beside the cottage
  grid.setBlock(25, 11, 28, BlockId.Lantern, false);

  const villager = createNpcActor('farmer', 10, 9, 10, 0, 1);
  const duskSlime = createNpcActor('slime', 10, 9, 10, 4, 7);
  const daySlime = createNpcActor('slime', 10, 9, 10, 4, 7);
  const actors = [villager, duskSlime, daySlime];

  // Clear dusk prompts villager to seek the lantern coordinates rather than plot center
  stepNpcActor(villager, grid, actors, { x: 2, y: 9, z: 2 }, false, [plot], 0.1, 0.78, 20, 'clear');
  assert.equal(villager.state, 'seek_shelter');
  assert.equal(villager.targetX, 25.5);
  assert.equal(villager.targetZ, 28.5);

  const duskLine = interactWithNpc(villager, 21, 'clear', 0.78);
  assert.ok(/lantern|hearth|dusk|sunrise|night/i.test(duskLine));

  // Distant player at 17 blocks away triggers nocturnal monster prowl at dusk, whereas day slime stays idle/wander
  duskSlime.stateTimer = 0.05;
  daySlime.stateTimer = 0.05;
  stepNpcActor(duskSlime, grid, actors, { x: 27, y: 9, z: 10 }, false, [plot], 0.1, 0.78, 22, 'clear');
  stepNpcActor(daySlime, grid, actors, { x: 27, y: 9, z: 10 }, false, [plot], 0.1, 0.28, 22, 'clear');
  assert.equal(duskSlime.state, 'prowl');
  assert.notEqual(daySlime.state, 'prowl');
});
