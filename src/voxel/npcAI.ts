import { BlockId, NpcActor, NpcBehaviorState, VillagePlot, WeatherType } from './types';
import { VoxelGrid, WATER_LEVEL } from './voxelGrid';

const ROLE_SPEED: Record<string, number> = {
  mason: 1.85,
  farmer: 1.65,
  ranger: 2.25,
  sheep: 1.25,
  fox: 2.85,
  songbird: 3.4,
  slime: 1.55,
  golem: 1.35,
  wraith: 2.35,
};

const ROLE_SPEECH: Record<string, string[]> = {
  mason: [
    'Checking load-bearing timber joints.',
    'That stone foundation will hold steady!',
    'Need a hand expanding the village?',
  ],
  farmer: [
    'Meadow soil is rich this season.',
    'Keep an eye on the sheep grazing nearby.',
    'Fresh timber and cobblestone make fine homes.',
  ],
  ranger: [
    'Patrolling the biome frontier.',
    'All structural beacons look bright!',
    'New trails lead toward the outer ridge.',
  ],
  sheep: ['Baa~', '*munches meadow grass*'],
  fox: ['*curious sniff*', '*darts softly through brush*'],
  songbird: ['*chirp-trill!*', '*circles the rooftops*'],
  slime: ['*squelch-bounce!*', '*jiggles emerald jelly*'],
  golem: ['*deep basalt rumble*', 'Rune core steady. Guarding the ridge.'],
  wraith: ['*ethereal chime echoes in the wind*', '*drifts silently on violet currents*'],
};

const WEATHER_SPEECH: Record<Exclude<WeatherType, 'clear'>, Record<string, string[]>> = {
  rainy: {
    mason: [
      'Good thing these roofs are slate shingle!',
      'Heading under the eaves until the rain passes.',
    ],
    farmer: [
      'This rainfall will keep the meadows green!',
      'Staying dry inside the cottage.',
    ],
    ranger: [
      'Rain slicks the trails—watch your footing.',
      'Sheltering near the village plaza for a spell.',
    ],
    sheep: ['*huddles quietly out of the rain*', 'Baa~ *shakes damp wool*'],
    fox: ['*trots briskly for dry brush*', '*ears tucked from the rain*'],
    songbird: ['*glides low beneath the canopy*'],
    slime: ['*gleams happily in the rain!*', '*splashes across damp grass*'],
    golem: ['*raindrops steam lightly off warm rune core*'],
    wraith: ['*misty cloak swirls with the rainfall*'],
  },
  snowy: {
    mason: [
      'Snow load holds steady on reinforced trusses!',
      'Keep the lanterns lit through the snowfall.',
    ],
    farmer: [
      'Fresh powder settling over the village paths.',
      'Chilly air—sticking close to the warm cottages.',
    ],
    ranger: [
      'Snowflakes drifting across the outer ridges.',
      'Tracking fox prints in the fresh snow.',
    ],
    sheep: ['*huddles in thick wool against the snow*', 'Baa~ *frosty puff*'],
    fox: ['*bounds playfully through the snow*', '*pounces at drifting flakes*'],
    songbird: ['*flutters softly through winter flurries*'],
    slime: ['*bounces sluggishly in frosty powder*'],
    golem: ['*snowflakes melt over glowing amber shoulders*'],
    wraith: ['*glides effortlessly through winter wind*'],
  },
  storm: {
    mason: [
      'Thunder over the ridge! Get under a sturdy slate roof!',
      'Bracing the timber beams against these storm gusts.',
    ],
    farmer: [
      'Counting seconds between the lightning flash and thunder!',
      'Sheltering inside until the thunderstorm rolls past.',
    ],
    ranger: [
      'Watch the high peaks—lightning strikes close in this squall!',
      'All lanterns burning bright against the storm clouds.',
    ],
    sheep: ['*presses close under the eaves as thunder rolls*', 'Baa! *startled by thunder*'],
    fox: ['*curls beneath dense canopy away from the lightning*', '*ears flat against the gale*'],
    songbird: ['*tucks low beneath the roof eaves out of the storm*'],
    slime: ['*vibrates eagerly with every thunderclap!*'],
    golem: ['*stands unmoved like obsidian against the gale*'],
    wraith: ['*crackles with cyan stormlight!*'],
  },
};

const DUSK_SPEECH: Record<string, string[]> = {
  mason: [
    'Evening dusk settles—gathering by the warm cottage lanterns.',
    'All timber joints hold firm as night approaches.',
  ],
  farmer: [
    'Heading inside where the porch lanterns burn bright!',
    'Best stay near the cottage hearth until sunrise.',
  ],
  ranger: [
    'Watching the perimeter from the lantern-lit eaves.',
    'Nocturnal creatures stir outside the village glow!',
  ],
  slime: ['*pulses with eerie nightglow in the shadows!*'],
  golem: ['*molten rune eyes flare bright after sundown!*'],
  wraith: ['*glides eagerly through the dusk mist!*'],
};

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function isDuskOrNightTime(timeOfDay: number): boolean {
  return timeOfDay >= 0.68 || timeOfDay <= 0.18;
}

function deterministicHash(str: string, tick: number): number {
  let h = 2166136261 ^ tick;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function findNearestPlot(actor: NpcActor, plots: VillagePlot[]): { plot: VillagePlot; dist: number } | null {
  if (plots.length === 0) return null;
  let nearest = plots[0];
  let bestD = Infinity;
  for (const p of plots) {
    const d = Math.hypot(p.centerX - actor.x, p.centerZ - actor.z);
    if (d < bestD) {
      bestD = d;
      nearest = p;
    }
  }
  return { plot: nearest, dist: bestD };
}

/**
 * Finds the nearest lantern-lit cottage / plot gathering point for dusk, rain, or storm schedules.
 * Scans around nearby VillagePlots for lit BlockId.Lantern beacons, falling back to plot center.
 */
export function findLanternLitShelterSpot(
  grid: VoxelGrid,
  plots: VillagePlot[],
  actor: NpcActor
): { x: number; z: number; dist: number; hasLantern: boolean } | null {
  const nearestInfo = findNearestPlot(actor, plots);
  if (!nearestInfo) return null;

  const { plot } = nearestInfo;
  const rX = Math.ceil(plot.width * 0.5) + 3;
  const rZ = Math.ceil(plot.depth * 0.5) + 4;
  let bestLanternDist = Infinity;
  let lanternX = plot.centerX + 0.5;
  let lanternZ = plot.centerZ + 0.5;
  let foundLantern = false;

  const minY = Math.max(1, plot.baseY - 1);
  const maxY = Math.min(grid.sizeY - 1, plot.baseY + plot.height + 3);
  for (let lx = plot.centerX - rX; lx <= plot.centerX + rX; lx++) {
    for (let lz = plot.centerZ - rZ; lz <= plot.centerZ + rZ; lz++) {
      if (!grid.hasSectorAt(lx, lz)) continue;
      for (let ly = minY; ly <= maxY; ly++) {
        if (grid.getBlock(lx, ly, lz) === BlockId.Lantern) {
          const d = Math.hypot(lx + 0.5 - actor.x, lz + 0.5 - actor.z);
          if (d < bestLanternDist) {
            bestLanternDist = d;
            lanternX = lx + 0.5;
            lanternZ = lz + 0.5;
            foundLantern = true;
          }
        }
      }
    }
  }

  return {
    x: lanternX,
    z: lanternZ,
    dist: foundLantern ? bestLanternDist : nearestInfo.dist,
    hasLantern: foundLantern,
  };
}

function clampNpcX(grid: VoxelGrid, val: number, margin: number): number {
  return grid.isEndless ? val : Math.max(margin, Math.min(grid.sizeX - margin - 1, val));
}

function clampNpcZ(grid: VoxelGrid, val: number, margin: number): number {
  return grid.isEndless ? val : Math.max(margin, Math.min(grid.sizeZ - margin - 1, val));
}

/**
 * Pure deterministic AI step for villagers and animals.
 * Handles Finite State Machine transitions, flock/social behaviors,
 * shelter-seeking at dusk or during rain, weather-reactive pacing,
 * fleeing from sprinting player, and voxel step-up navigation.
 */
export function stepNpcActor(
  actor: NpcActor,
  grid: VoxelGrid,
  allActors: NpcActor[],
  playerPos: { x: number; y: number; z: number },
  playerSprinting: boolean,
  plots: VillagePlot[],
  dt: number,
  timeOfDay: number,
  simTick: number,
  weather: WeatherType = 'clear'
): void {
  if (actor.speechTimer > 0) {
    actor.speechTimer = Math.max(0, actor.speechTimer - dt);
    if (actor.speechTimer === 0) actor.speech = '';
  }

  // Flying songbird behavior: smooth figure-8 orbit; lowers & slows during rain/storm/snow
  if (actor.role === 'songbird') {
    actor.state = 'soar';
    const weatherSpeedMult =
      weather === 'storm' ? 0.58 : weather === 'rainy' ? 0.72 : weather === 'snowy' ? 0.85 : 1.0;
    const orbitScale =
      weather === 'storm' ? 0.42 : weather === 'rainy' ? 0.55 : weather === 'snowy' ? 0.75 : 1.0;
    actor.walkPhase += dt * 7.5 * weatherSpeedMult;
    const angle = actor.walkPhase * 0.14;
    const desiredX = actor.homeX + Math.cos(angle) * 8.5 * orbitScale;
    const desiredZ = actor.homeZ + Math.sin(angle * 2) * 5.5 * orbitScale;
    const dx = desiredX - actor.x;
    const dz = desiredZ - actor.z;
    const dist = Math.hypot(dx, dz) || 1;
    const speed = ROLE_SPEED.songbird * weatherSpeedMult;
    actor.vx = (dx / dist) * speed;
    actor.vz = (dz / dist) * speed;
    actor.x = clampNpcX(grid, actor.x + actor.vx * dt, 2);
    actor.z = clampNpcZ(grid, actor.z + actor.vz * dt, 2);
    const groundY = grid.getSurfaceY(actor.x, actor.z, true);
    const baseHeight =
      weather === 'storm' ? 2.1 : weather === 'rainy' ? 2.6 : weather === 'snowy' ? 3.5 : 4.5;
    const altTarget =
      weather === 'storm' ? 11.5 : weather === 'rainy' ? 13 : weather === 'snowy' ? 14.5 : 16;
    const desiredY = Math.max(
      groundY + baseHeight,
      altTarget + Math.sin(angle * 1.5) * (weather === 'storm' ? 0.8 : weather === 'rainy' ? 1.1 : 2.2)
    );
    actor.y += (desiredY - actor.y) * Math.min(1, dt * 3);
    actor.yaw = Math.atan2(actor.vx, actor.vz);
    return;
  }

  const distToPlayer = Math.hypot(playerPos.x - actor.x, playerPos.z - actor.z);
  const isDuskOrNight = isDuskOrNightTime(timeOfDay);
  const nocturnalBoost = isDuskOrNight || weather === 'storm';

  // Hovering Storm Wraith monster AI: floats gracefully around its anchor or prowls near traveler
  if (actor.role === 'wraith') {
    actor.state = 'hover';
    const stormBoost =
      (weather === 'storm' ? 1.32 : 1.0) * (isDuskOrNight ? 1.24 : 1.0);
    actor.walkPhase += dt * 3.8 * stormBoost;
    const angle = actor.walkPhase * 0.22;
    let desiredX = actor.homeX + Math.cos(angle) * 5.2;
    let desiredZ = actor.homeZ + Math.sin(angle * 1.4) * 4.4;
    const wraithDetect = nocturnalBoost ? 20.0 : 13.0;
    if (distToPlayer < wraithDetect && distToPlayer > 3.0) {
      const toPlayerAngle = Math.atan2(playerPos.z - actor.z, playerPos.x - actor.x);
      desiredX = playerPos.x - Math.cos(toPlayerAngle) * 3.0;
      desiredZ = playerPos.z - Math.sin(toPlayerAngle) * 3.0;
    }
    const dx = desiredX - actor.x;
    const dz = desiredZ - actor.z;
    const dist = Math.hypot(dx, dz) || 1;
    const speed = (ROLE_SPEED.wraith ?? 2.35) * stormBoost;
    actor.vx = dist > 0.25 ? (dx / dist) * speed : 0;
    actor.vz = dist > 0.25 ? (dz / dist) * speed : 0;
    actor.x = clampNpcX(grid, actor.x + actor.vx * dt, 2);
    actor.z = clampNpcZ(grid, actor.z + actor.vz * dt, 2);
    const groundY = grid.getSurfaceY(Math.floor(actor.x), Math.floor(actor.z), true);
    const hoverHeight = (nocturnalBoost ? 2.4 : 1.75) + Math.sin(angle * 2) * 0.35;
    actor.y += (groundY + hoverHeight - actor.y) * Math.min(1, dt * 4);
    const lookYaw =
      distToPlayer < 10
        ? Math.atan2(playerPos.x - actor.x, playerPos.z - actor.z)
        : Math.atan2(actor.vx, actor.vz);
    if (Number.isFinite(lookYaw)) {
      const diff = wrapAngle(lookYaw - actor.yaw);
      actor.yaw = wrapAngle(actor.yaw + diff * Math.min(1, dt * 6));
    }
    return;
  }

  // Animal flee reaction when player approaches quickly
  if (actor.isAnimal && distToPlayer < (playerSprinting ? 7.5 : 3.2) && actor.state !== 'flee') {
    actor.state = 'flee';
    actor.stateTimer = 2.6;
    const awayX = actor.x - playerPos.x;
    const awayZ = actor.z - playerPos.z;
    const len = Math.hypot(awayX, awayZ) || 1;
    actor.targetX = clampNpcX(grid, actor.x + (awayX / len) * 10, 4);
    actor.targetZ = clampNpcZ(grid, actor.z + (awayZ / len) * 10, 4);
  }

  // Dusk, Rainy, or Thunderstorm lantern-cottage shelter seeking for villagers (not animals or monsters)
  const shouldSeekShelter =
    !actor.isAnimal &&
    !actor.isMonster &&
    (isDuskOrNight || weather === 'rainy' || weather === 'storm');
  const shelterSpot = findLanternLitShelterSpot(grid, plots, actor);

  if (shouldSeekShelter && shelterSpot && actor.state !== 'seek_shelter') {
    if (shelterSpot.dist > 2.8) {
      actor.state = 'seek_shelter';
      actor.targetX = shelterSpot.x;
      actor.targetZ = shelterSpot.z;
      actor.stateTimer = 6.0;
    }
  }

  actor.stateTimer -= dt;

  // Choose next AI state when timer expires
  if (actor.stateTimer <= 0) {
    const r = deterministicHash(actor.id, simTick);
    if (actor.isMonster) {
      const monsterDetectRadius = nocturnalBoost ? 21.0 : 13.5;
      const monsterProwlChance = nocturnalBoost ? 0.9 : 0.72;
      if (distToPlayer < monsterDetectRadius && distToPlayer > 2.6) {
        actor.state = 'prowl';
        actor.stateTimer = (nocturnalBoost ? 1.8 : 2.2) + r * 1.4;
        const approachScale = Math.max(0.45, (distToPlayer - 2.4) / distToPlayer);
        actor.targetX = clampNpcX(grid, actor.x + (playerPos.x - actor.x) * approachScale, 3);
        actor.targetZ = clampNpcZ(grid, actor.z + (playerPos.z - actor.z) * approachScale, 3);
      } else if (actor.state === 'idle' || r < monsterProwlChance) {
        actor.state = 'prowl';
        actor.stateTimer = (nocturnalBoost ? 3.2 : 2.6) + r * 2.4;
        const angle = r * Math.PI * 2;
        const rad = (nocturnalBoost ? 5.5 : 3.5) + r * 7.5;
        actor.targetX = clampNpcX(grid, actor.homeX + Math.cos(angle) * rad, 4);
        actor.targetZ = clampNpcZ(grid, actor.homeZ + Math.sin(angle) * rad, 4);
      } else {
        actor.state = 'idle';
        actor.stateTimer = (nocturnalBoost ? 0.7 : 1.6) + r * 1.1;
      }
    } else if (actor.isAnimal) {
      if (actor.state === 'graze' || actor.state === 'flee') {
        actor.state = 'wander';
        actor.stateTimer = (weather === 'rainy' || weather === 'storm' ? 2.2 : 3.0) + r * 2.8;
        const angle = r * Math.PI * 2;
        const radScale =
          weather === 'storm' ? 0.42 : weather === 'rainy' ? 0.55 : weather === 'snowy' ? 0.75 : 1.0;
        const rad = (4 + r * 7) * radScale;
        actor.targetX = clampNpcX(grid, actor.homeX + Math.cos(angle) * rad, 4);
        actor.targetZ = clampNpcZ(grid, actor.homeZ + Math.sin(angle) * rad, 4);
      } else {
        actor.state = 'graze';
        actor.stateTimer = (weather === 'rainy' || weather === 'storm' ? 3.8 : 2.5) + r * 3.0;
      }
    } else if (shouldSeekShelter && shelterSpot && shelterSpot.dist <= 3.1) {
      // Villager is sheltered warmly by lantern-lit cottage during dusk/rain/storm
      actor.state = 'idle';
      actor.stateTimer = 2.5 + r * 2.5;
      if (r < 0.34 && actor.speechTimer <= 0) {
        const pool =
          weather !== 'clear'
            ? WEATHER_SPEECH[weather][actor.role] ?? ROLE_SPEECH[actor.role]
            : DUSK_SPEECH[actor.role] ?? ROLE_SPEECH[actor.role];
        actor.speech = pool[Math.floor(r * 10 * pool.length) % pool.length];
        actor.speechTimer = 2.8;
      }
    } else {
      // Villager AI: patrol plots, socialize with nearby villagers, or idle-inspect
      let nearbyPeer: NpcActor | null = null;
      for (const other of allActors) {
        if (other.id === actor.id || other.isAnimal || other.isMonster) continue;
        const d = Math.hypot(other.x - actor.x, other.z - actor.z);
        if (d < 5.5 && d > 1.2) {
          nearbyPeer = other;
          break;
        }
      }

      if (nearbyPeer && r < 0.45) {
        actor.state = 'socialize';
        actor.stateTimer = 2.6;
        actor.targetX = nearbyPeer.x;
        actor.targetZ = nearbyPeer.z;
        const lines =
          weather !== 'clear' && r < 0.25
            ? WEATHER_SPEECH[weather][actor.role]
            : ROLE_SPEECH[actor.role];
        actor.speech = lines[Math.floor(r * lines.length) % lines.length];
        actor.speechTimer = 2.4;
      } else if (plots.length > 0 && r < 0.8) {
        actor.state = 'patrol';
        actor.stateTimer = 4.5 + r * 3.5;
        const plot = plots[Math.floor(r * plots.length * 10) % plots.length];
        const offsetAngle = r * Math.PI * 2;
        const patrolRadius = weather === 'snowy' ? 2.8 : 5;
        actor.targetX = clampNpcX(grid, plot.centerX + Math.cos(offsetAngle) * patrolRadius, 4);
        actor.targetZ = clampNpcZ(grid, plot.centerZ + Math.sin(offsetAngle) * patrolRadius, 4);
      } else {
        actor.state = 'idle';
        actor.stateTimer = 1.8 + r * 2.0;
      }
    }
  }

  // Movement & Voxel Step-Up Collision
  const movingState: NpcBehaviorState[] = ['wander', 'patrol', 'flee', 'seek_shelter', 'prowl'];
  if (movingState.includes(actor.state)) {
    const dx = actor.targetX - actor.x;
    const dz = actor.targetZ - actor.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.75) {
      actor.vx = 0;
      actor.vz = 0;
      actor.state = actor.isAnimal ? 'graze' : 'idle';
      actor.stateTimer = 1.5;
    } else {
      const baseSpeed = ROLE_SPEED[actor.role] ?? 1.6;
      let weatherMult = 1.0;
      if (actor.isMonster) {
        if (isDuskOrNight) weatherMult *= 1.28;
        if (weather === 'storm') weatherMult *= 1.18;
      } else if (weather === 'rainy' || weather === 'storm') {
        if (actor.state === 'seek_shelter') weatherMult = weather === 'storm' ? 1.38 : 1.24;
        else if (actor.role === 'fox') weatherMult = 1.2;
        else if (actor.role === 'sheep') weatherMult = 0.68;
      } else if (isDuskOrNight && actor.state === 'seek_shelter') {
        weatherMult = 1.22;
      } else if (weather === 'snowy') {
        if (!actor.isAnimal) weatherMult = 0.82;
        else if (actor.role === 'fox') weatherMult = 1.15;
        else if (actor.role === 'sheep') weatherMult = 0.78;
      }
      const speed = (actor.state === 'flee' ? baseSpeed * 1.65 : baseSpeed) * weatherMult;
      const dirX = dx / dist;
      const dirZ = dz / dist;

      const nextX = clampNpcX(grid, actor.x + dirX * speed * dt, 2.5);
      const nextZ = clampNpcZ(grid, actor.z + dirZ * speed * dt, 2.5);

      const gx = Math.floor(nextX);
      const gz = Math.floor(nextZ);
      const sectorLoaded = grid.hasSectorAt(gx, gz);
      const nextGroundY = grid.getSurfaceY(gx, gz, false);
      const blockBelow = grid.getBlock(gx, nextGroundY - 1, gz);
      const heightDiff = nextGroundY - actor.y;

      // Can step up 1 block or drop down 2 blocks; avoid deep water, unloaded edge, or sheer walls
      const canStep =
        sectorLoaded &&
        blockBelow !== BlockId.Water &&
        nextGroundY - 1 >= WATER_LEVEL &&
        heightDiff <= 1.25 &&
        heightDiff >= -2.5 &&
        !grid.isSolid(gx, Math.floor(nextGroundY + 1), gz);

      if (canStep) {
        actor.vx = (nextX - actor.x) / Math.max(0.001, dt);
        actor.vz = (nextZ - actor.z) / Math.max(0.001, dt);
        actor.x = nextX;
        actor.z = nextZ;
        // Smooth vertical interpolation on step-up
        actor.y += (nextGroundY - actor.y) * Math.min(1, dt * 12);
        actor.walkPhase += speed * dt * 2.6;
      } else {
        // Blocked by wall or water: pick a new perpendicular wander angle
        actor.vx = 0;
        actor.vz = 0;
        const turnAngle = actor.yaw + Math.PI * 0.65;
        actor.targetX = clampNpcX(grid, actor.x + Math.sin(turnAngle) * 5, 4);
        actor.targetZ = clampNpcZ(grid, actor.z + Math.cos(turnAngle) * 5, 4);
      }

      const targetYaw = Math.atan2(dirX, dirZ);
      const diffYaw = wrapAngle(targetYaw - actor.yaw);
      actor.yaw = wrapAngle(actor.yaw + diffYaw * Math.min(1, dt * 8));
    }
  } else {
    actor.vx = 0;
    actor.vz = 0;
    // Gently ground to surface if terrain under idle actor was edited
    const groundY = grid.getSurfaceY(Math.floor(actor.x), Math.floor(actor.z), false);
    actor.y += (groundY - actor.y) * Math.min(1, dt * 10);

    // If socializing or player is close, turn head/body gently toward target/player
    if (!actor.isAnimal && distToPlayer < 4.5) {
      const lookYaw = Math.atan2(playerPos.x - actor.x, playerPos.z - actor.z);
      const diff = wrapAngle(lookYaw - actor.yaw);
      actor.yaw = wrapAngle(actor.yaw + diff * Math.min(1, dt * 5));
    }
  }
}

export function interactWithNpc(
  actor: NpcActor,
  tick: number,
  weather: WeatherType = 'clear',
  timeOfDay = 0.28
): string {
  const pool =
    weather !== 'clear'
      ? WEATHER_SPEECH[weather][actor.role] ?? ROLE_SPEECH[actor.role]
      : isDuskOrNightTime(timeOfDay) && DUSK_SPEECH[actor.role]
      ? DUSK_SPEECH[actor.role]
      : ROLE_SPEECH[actor.role] ?? ['Hello traveler!'];
  const idx = Math.floor(deterministicHash(actor.id, tick) * pool.length) % pool.length;
  actor.speech = pool[idx];
  actor.speechTimer = 4.0;
  return `${actor.name} (${actor.role}): "${actor.speech}"`;
}
