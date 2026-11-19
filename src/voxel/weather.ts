import { BIOME_PRESETS, BiomeId, WeatherType } from './types';

export interface WeatherState {
  current: WeatherType;
  previous: WeatherType;
  transition: number; // 0..1 blend from previous to current
  intensity: number; // 0..1 precipitation strength
  cycleTimer: number;
  cycleDuration: number;
  autoCycle: boolean;
  windX: number;
  windZ: number;
  cycleIndex: number;
  lightningFlash: number; // 0..1 visual flash intensity
  lightningTimer: number; // seconds until next thunderstorm bolt
  lightningEnvelope: number; // remaining active flicker time (s)
  lightningOffsetX: number;
  lightningOffsetZ: number;
  thunderCount: number;
}

export interface WeatherAtmosphere {
  skyColorHex: string;
  fogColorHex: string;
  seaColorHex: string;
  fogDensity: number;
  sunIntensityMult: number;
  hemiIntensityMult: number;
  rainAmount: number;
  snowAmount: number;
  stormAmount: number;
  cloudColorHex: string;
  cloudShadeHex: string;
  cloudCoverage: number;
  cloudScaleMult: number;
  cloudOpacity: number;
  cloudAltitude: number;
  lightningFlash: number;
}

const WEATHER_ORDER: WeatherType[] = ['clear', 'rainy', 'storm', 'snowy'];

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function lerpColorHex(hexA: string, hexB: string, t: number): string {
  const s = Math.max(0, Math.min(1, t));
  const [ar, ag, ab] = hexToRgb(hexA);
  const [br, bg, bb] = hexToRgb(hexB);
  return rgbToHex(lerp(ar, br, s), lerp(ag, bg, s), lerp(ab, bb, s));
}

function pseudoHash(index: number): number {
  let h = (index + 1) * 2654435761;
  h ^= h >>> 16;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967295;
}

export function getWeatherCycleDuration(weather: WeatherType, biome: BiomeId): number {
  const base: Record<WeatherType, number> = {
    clear: 38,
    rainy: 28,
    storm: 24,
    snowy: 28,
  };
  let dur = base[weather];
  if (biome === 'alpine_peaks' && weather === 'snowy') dur += 12;
  if (biome === 'redstone_oasis' && weather === 'clear') dur += 10;
  if (biome === 'blossom_grove' && (weather === 'rainy' || weather === 'storm')) dur += 6;
  return dur;
}

function getWindForWeather(weather: WeatherType, cycleIndex: number): { windX: number; windZ: number } {
  const angle = (cycleIndex * 1.6180339) % (Math.PI * 2);
  const speed =
    weather === 'storm' ? 6.2 : weather === 'rainy' ? 3.2 : weather === 'snowy' ? 1.4 : 0.7;
  return {
    windX: Math.cos(angle) * speed,
    windZ: Math.sin(angle) * speed,
  };
}

function computeLightningOffset(thunderCount: number): { x: number; z: number } {
  const h1 = pseudoHash(thunderCount * 7 + 3);
  const h2 = pseudoHash(thunderCount * 13 + 11);
  const angle = h1 * Math.PI * 2;
  const dist = 26 + h2 * 44;
  return {
    x: Math.cos(angle) * dist,
    z: Math.sin(angle) * dist,
  };
}

function computeLightningEnvelopeValue(remaining: number): number {
  // 0.42s crisp double-flicker lightning envelope
  if (remaining <= 0) return 0;
  const elapsed = Math.max(0, 0.42 - remaining);
  if (elapsed < 0.06) return 1.0;
  if (elapsed < 0.12) return 0.25;
  if (elapsed < 0.2) return 0.88;
  return Math.max(0, 0.88 * (1 - (elapsed - 0.2) / 0.22));
}

export function createInitialWeatherState(biome: BiomeId = 'mixed'): WeatherState {
  const wind = getWindForWeather('clear', 0);
  const offset = computeLightningOffset(0);
  return {
    current: 'clear',
    previous: 'clear',
    transition: 1,
    intensity: 0,
    cycleTimer: 0,
    cycleDuration: getWeatherCycleDuration('clear', biome),
    autoCycle: true,
    windX: wind.windX,
    windZ: wind.windZ,
    cycleIndex: 0,
    lightningFlash: 0,
    lightningTimer: 3.5,
    lightningEnvelope: 0,
    lightningOffsetX: offset.x,
    lightningOffsetZ: offset.z,
    thunderCount: 0,
  };
}

export function nextWeatherInCycle(current: WeatherType): WeatherType {
  const idx = WEATHER_ORDER.indexOf(current);
  return WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length];
}

export function setWeatherCondition(
  state: WeatherState,
  target: WeatherType,
  biome: BiomeId,
  autoCycle?: boolean,
  instant = false
): WeatherState {
  const nextAuto = autoCycle !== undefined ? autoCycle : state.autoCycle;
  if (target === state.current) {
    return {
      ...state,
      autoCycle: nextAuto,
      cycleTimer: 0,
      transition: instant ? 1 : state.transition,
      intensity: instant ? (target === 'clear' ? 0 : 1) : state.intensity,
    };
  }
  const nextIndex = state.cycleIndex + 1;
  const wind = getWindForWeather(target, nextIndex);
  const enteringStorm = target === 'storm';
  const nextThunder = enteringStorm ? state.thunderCount + 1 : state.thunderCount;
  const offset = computeLightningOffset(nextThunder);

  return {
    ...state,
    previous: state.current,
    current: target,
    transition: instant ? 1 : 0,
    intensity: instant ? (target === 'clear' ? 0 : 1) : state.intensity,
    cycleTimer: 0,
    cycleDuration: getWeatherCycleDuration(target, biome),
    autoCycle: nextAuto,
    windX: wind.windX,
    windZ: wind.windZ,
    cycleIndex: nextIndex,
    lightningEnvelope: enteringStorm && instant ? 0.42 : 0,
    lightningFlash: enteringStorm && instant ? 1.0 : 0,
    lightningTimer: enteringStorm ? 4.2 : 3.5,
    lightningOffsetX: offset.x,
    lightningOffsetZ: offset.z,
    thunderCount: nextThunder,
  };
}

export function stepWeatherState(
  state: WeatherState,
  dt: number,
  biome: BiomeId
): { state: WeatherState; changed: boolean; triggeredLightning: boolean } {
  let next: WeatherState = { ...state };
  let changed = false;
  let triggeredLightning = false;

  if (next.transition < 1) {
    next.transition = Math.min(1, next.transition + dt * 0.85);
  }

  if (next.autoCycle) {
    next.cycleTimer += dt;
    if (next.cycleTimer >= next.cycleDuration) {
      const target = nextWeatherInCycle(next.current);
      next = setWeatherCondition(next, target, biome, true, false);
      changed = true;
    }
  }

  const blend = smoothstep(next.transition);
  const prevPrecip = next.previous === 'clear' ? 0 : 1;
  const currPrecip = next.current === 'clear' ? 0 : 1;
  next.intensity = lerp(prevPrecip, currPrecip, blend);

  // Thunderstorm lightning scheduling & double-flicker decay
  const stormPresence =
    next.current === 'storm' ? blend : next.previous === 'storm' ? 1 - blend : 0;

  if (next.lightningEnvelope > 0) {
    next.lightningEnvelope = Math.max(0, next.lightningEnvelope - dt);
    next.lightningFlash = computeLightningEnvelopeValue(next.lightningEnvelope);
  } else {
    next.lightningFlash = 0;
  }

  if (stormPresence > 0.35) {
    next.lightningTimer -= dt;
    if (next.lightningTimer <= 0) {
      next.thunderCount += 1;
      const offset = computeLightningOffset(next.thunderCount);
      next.lightningOffsetX = offset.x;
      next.lightningOffsetZ = offset.z;
      next.lightningEnvelope = 0.42;
      next.lightningFlash = 1.0;
      // Deterministic cadence between 3.6s and 7.8s during active storms
      next.lightningTimer = 3.6 + pseudoHash(next.thunderCount * 19 + 5) * 4.2;
      triggeredLightning = true;
    }
  }

  return { state: next, changed, triggeredLightning };
}

function getWeatherWeight(
  state: WeatherState,
  target: WeatherType,
  blend: number
): number {
  if (state.previous === target && state.current === target) return 1;
  if (state.current === target) return blend;
  if (state.previous === target) return 1 - blend;
  return 0;
}

export function getWeatherAtmosphere(
  state: WeatherState,
  biome: BiomeId,
  timeOfDay: number,
  dimension: 'overworld' | 'volcanic' | 'hawaii_beach' | 'dark_dungeon' = 'overworld'
): WeatherAtmosphere {
  const preset = BIOME_PRESETS[biome] ?? BIOME_PRESETS.mixed;
  const blend = smoothstep(state.transition);

  let clearW = getWeatherWeight(state, 'clear', blend);
  let rainW = getWeatherWeight(state, 'rainy', blend);
  let stormW = getWeatherWeight(state, 'storm', blend);
  let snowW = getWeatherWeight(state, 'snowy', blend);

  // Smooth fade when hopping directly between rain/storm and snow
  if (
    (state.previous === 'snowy' && (state.current === 'rainy' || state.current === 'storm')) ||
    ((state.previous === 'rainy' || state.previous === 'storm') && state.current === 'snowy')
  ) {
    const outWeight = Math.max(0, 1 - blend / 0.4);
    const inWeight = Math.max(0, (blend - 0.35) / 0.65);
    if (state.previous === 'snowy') {
      snowW = outWeight;
      rainW = state.current === 'rainy' ? inWeight : 0;
      stormW = state.current === 'storm' ? inWeight : 0;
    } else {
      snowW = inWeight;
      rainW = state.previous === 'rainy' ? outWeight : 0;
      stormW = state.previous === 'storm' ? outWeight : 0;
    }
  }

  const precipRain = Math.min(1, rainW + stormW);

  // Subtle dusk factor so sky & fog harmonize with sun angle
  const sunSin = Math.sin(timeOfDay * Math.PI * 2);
  const duskFactor = Math.max(0, Math.min(1, (0.25 - sunSin) / 1.15));

  // Keep Clear skies crisp sky-blue instead of washed-out gray
  let skyColor = lerpColorHex(preset.skyHorizon, '#8ec3ea', clearW * 0.42);
  let fogColor = lerpColorHex(preset.fogColor, '#b9dcf2', clearW * 0.35);
  let seaColor = '#347fa3';

  if (rainW > 0.001) {
    skyColor = lerpColorHex(skyColor, '#4c6075', rainW * 0.88);
    fogColor = lerpColorHex(fogColor, '#485b6e', rainW * 0.88);
    seaColor = lerpColorHex(seaColor, '#214559', rainW * 0.78);
  }
  if (stormW > 0.001) {
    skyColor = lerpColorHex(skyColor, '#232c3d', stormW * 0.94);
    fogColor = lerpColorHex(fogColor, '#242e3f', stormW * 0.94);
    seaColor = lerpColorHex(seaColor, '#162938', stormW * 0.86);
  }
  if (snowW > 0.001) {
    skyColor = lerpColorHex(skyColor, '#a4bbd1', snowW * 0.84);
    fogColor = lerpColorHex(fogColor, '#b8cbe0', snowW * 0.85);
    seaColor = lerpColorHex(seaColor, '#537e94', snowW * 0.55);
  }

  if (duskFactor > 0.01) {
    skyColor = lerpColorHex(skyColor, '#1d2740', duskFactor * 0.78);
    fogColor = lerpColorHex(fogColor, '#1c263d', duskFactor * 0.76);
    seaColor = lerpColorHex(seaColor, '#152538', duskFactor * 0.65);
  }

  // Cloud palette & geometry parameters driven by weather
  let cloudColor = '#ffffff';
  let cloudShade = '#d9e8f5';
  if (rainW > 0.001) {
    cloudColor = lerpColorHex(cloudColor, '#8293a6', rainW);
    cloudShade = lerpColorHex(cloudShade, '#5e7085', rainW);
  }
  if (stormW > 0.001) {
    cloudColor = lerpColorHex(cloudColor, '#3a4559', stormW);
    cloudShade = lerpColorHex(cloudShade, '#232b38', stormW);
  }
  if (snowW > 0.001) {
    cloudColor = lerpColorHex(cloudColor, '#e6eff7', snowW);
    cloudShade = lerpColorHex(cloudShade, '#bfd0e0', snowW);
  }
  if (duskFactor > 0.01) {
    cloudColor = lerpColorHex(cloudColor, '#7282a3', duskFactor * 0.62);
    cloudShade = lerpColorHex(cloudShade, '#3c4966', duskFactor * 0.68);
  }

  // Dimension atmospheric overrides for Volcanic, Hawaii Beach, and Dark Dungeon
  let fogDensity =
    0.0095 + rainW * 0.013 + snowW * 0.011 + stormW * 0.0175 + duskFactor * 0.004;
  let sunIntensityMult =
    Math.max(0.18, (1 - rainW * 0.58 - snowW * 0.28 - stormW * 0.78) * (1 - duskFactor * 0.45));
  let hemiIntensityMult =
    (1 - rainW * 0.22 + snowW * 0.08 - stormW * 0.36) * (1 - duskFactor * 0.28);
  let cloudCoverage =
    clearW * 0.38 + rainW * 0.74 + snowW * 0.8 + stormW * 0.96;
  let cloudScaleMult =
    clearW * 1.0 + rainW * 1.28 + snowW * 1.18 + stormW * 1.56;
  let cloudOpacity =
    clearW * 0.9 + rainW * 0.94 + snowW * 0.92 + stormW * 0.97;
  let cloudAltitude =
    clearW * 42 + rainW * 37 + snowW * 39 + stormW * 33;

  if (dimension === 'volcanic') {
    skyColor = lerpColorHex(skyColor, '#4a1b12', 0.85);
    fogColor = lerpColorHex(fogColor, '#632717', 0.85);
    seaColor = '#e04f14';
    cloudColor = '#4a3836';
    cloudShade = '#2b201f';
    cloudCoverage = Math.max(cloudCoverage, 0.72);
    fogDensity = Math.max(fogDensity, 0.014);
    sunIntensityMult = Math.max(0.55, sunIntensityMult * 0.9);
  } else if (dimension === 'hawaii_beach') {
    skyColor = lerpColorHex('#57c0f7', skyColor, Math.min(0.45, rainW + stormW));
    fogColor = lerpColorHex('#c5ecfc', fogColor, Math.min(0.45, rainW + stormW));
    seaColor = '#1ca8c9';
    sunIntensityMult = Math.max(0.85, sunIntensityMult * 1.12);
    hemiIntensityMult = Math.max(0.95, hemiIntensityMult * 1.08);
  } else if (dimension === 'dark_dungeon') {
    skyColor = '#0b0d16';
    fogColor = '#121524';
    seaColor = '#101320';
    cloudColor = '#1b1e2e';
    cloudShade = '#0f121c';
    cloudCoverage = 0.08;
    cloudOpacity = 0.25;
    fogDensity = 0.022;
    sunIntensityMult = 0.36;
    hemiIntensityMult = 1.05;
  }

  // Lightning flash illuminates sky, clouds, and sun/hemi ambience
  const flash = Math.max(0, Math.min(1, state.lightningFlash));
  if (flash > 0.01) {
    skyColor = lerpColorHex(skyColor, '#cfdfff', flash * 0.72);
    fogColor = lerpColorHex(fogColor, '#b8ccf2', flash * 0.58);
    cloudColor = lerpColorHex(cloudColor, '#edf4ff', flash * 0.82);
    cloudShade = lerpColorHex(cloudShade, '#8ca8d9', flash * 0.55);
    sunIntensityMult += flash * 1.45;
    hemiIntensityMult += flash * 0.95;
  }

  return {
    skyColorHex: skyColor,
    fogColorHex: fogColor,
    seaColorHex: seaColor,
    fogDensity,
    sunIntensityMult,
    hemiIntensityMult,
    rainAmount: precipRain,
    snowAmount: snowW,
    stormAmount: stormW,
    cloudColorHex: cloudColor,
    cloudShadeHex: cloudShade,
    cloudCoverage: Math.min(1, Math.max(0, cloudCoverage)),
    cloudScaleMult,
    cloudOpacity,
    cloudAltitude,
    lightningFlash: flash,
  };
}
