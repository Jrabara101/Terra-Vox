import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialWeatherState,
  getWeatherAtmosphere,
  nextWeatherInCycle,
  setWeatherCondition,
  stepWeatherState,
} from './weather';

test('procedural weather cycles deterministically through clear, rainy, storm, and snowy', () => {
  let state = createInitialWeatherState('mixed');
  assert.equal(state.current, 'clear');
  assert.equal(state.intensity, 0);

  const clearAtmo = getWeatherAtmosphere(state, 'mixed', 0.28);
  assert.equal(clearAtmo.cloudColorHex.toLowerCase(), '#ffffff');
  assert.ok(clearAtmo.cloudCoverage < 0.5);

  // Advance past clear cycle duration -> rainy
  let changedToRain = false;
  for (let i = 0; i < 60; i++) {
    const res = stepWeatherState(state, 1.0, 'mixed');
    state = res.state;
    if (res.changed) {
      changedToRain = true;
      break;
    }
  }
  assert.equal(changedToRain, true);
  assert.equal(state.current, 'rainy');

  // Ramp transition to full rain intensity
  for (let i = 0; i < 6; i++) {
    state = stepWeatherState(state, 1.0, 'mixed').state;
  }
  assert.ok(state.intensity > 0.9);
  const rainAtmo = getWeatherAtmosphere(state, 'mixed', 0.28);
  assert.ok(rainAtmo.rainAmount > 0.9);
  assert.ok(rainAtmo.cloudCoverage > 0.65);
  assert.ok(rainAtmo.fogDensity > 0.018);
  assert.ok(rainAtmo.sunIntensityMult < 0.65);

  // Advance past rainy cycle duration -> thunderstorm ('storm')
  let changedToStorm = false;
  for (let i = 0; i < 45; i++) {
    const res = stepWeatherState(state, 1.0, 'mixed');
    state = res.state;
    if (res.changed) {
      changedToStorm = true;
      break;
    }
  }
  assert.equal(changedToStorm, true);
  assert.equal(state.current, 'storm');

  // Ramp to storm and verify lightning strikes trigger & storm clouds thicken/darken
  let sawLightning = false;
  for (let i = 0; i < 12; i++) {
    const res = stepWeatherState(state, 0.5, 'mixed');
    state = res.state;
    if (res.triggeredLightning) sawLightning = true;
  }
  assert.equal(sawLightning, true);
  assert.ok(state.thunderCount >= 1);

  // Let active lightning flash settle to test base storm cloud darkness
  for (let i = 0; i < 4; i++) {
    state = stepWeatherState(state, 0.2, 'mixed').state;
  }
  const stormAtmo = getWeatherAtmosphere(state, 'mixed', 0.28);
  assert.ok(stormAtmo.stormAmount > 0.9);
  assert.ok(stormAtmo.cloudCoverage > 0.9);
  assert.ok(stormAtmo.cloudAltitude < clearAtmo.cloudAltitude);
  assert.notEqual(stormAtmo.cloudColorHex.toLowerCase(), '#ffffff');

  // Advance past storm cycle duration -> snowy
  let changedToSnow = false;
  for (let i = 0; i < 40; i++) {
    const res = stepWeatherState(state, 1.0, 'mixed');
    state = res.state;
    if (res.changed) {
      changedToSnow = true;
      break;
    }
  }
  assert.equal(changedToSnow, true);
  assert.equal(state.current, 'snowy');

  for (let i = 0; i < 6; i++) {
    state = stepWeatherState(state, 1.0, 'mixed').state;
  }
  const snowAtmo = getWeatherAtmosphere(state, 'mixed', 0.28);
  assert.ok(snowAtmo.snowAmount > 0.9);
  assert.equal(nextWeatherInCycle('snowy'), 'clear');
});

test('manual weather override, storm flash envelope, and auto-cycle lock preserve state cleanly', () => {
  let state = createInitialWeatherState('alpine_peaks');
  state = setWeatherCondition(state, 'storm', 'alpine_peaks', false, true);
  assert.equal(state.current, 'storm');
  assert.equal(state.autoCycle, false);
  assert.equal(state.lightningFlash, 1.0);

  // Instant storm flash fades naturally after ~0.5s
  for (let i = 0; i < 5; i++) {
    state = stepWeatherState(state, 0.12, 'alpine_peaks').state;
  }
  assert.equal(state.lightningFlash, 0);

  for (let i = 0; i < 60; i++) {
    const res = stepWeatherState(state, 1.0, 'alpine_peaks');
    state = res.state;
    assert.equal(res.changed, false);
  }
  assert.equal(state.current, 'storm');
  assert.ok(state.intensity > 0.95);
});

test('dimension atmosphere overrides apply Volcanic, Hawaii Beach, and Dark Dungeon skies and seas', () => {
  const clear = createInitialWeatherState('mixed');

  const volcanic = getWeatherAtmosphere(clear, 'mixed', 0.28, 'volcanic');
  assert.equal(volcanic.seaColorHex.toLowerCase(), '#e04f14');
  assert.ok(volcanic.fogDensity >= 0.014);

  const hawaii = getWeatherAtmosphere(clear, 'mixed', 0.28, 'hawaii_beach');
  assert.equal(hawaii.seaColorHex.toLowerCase(), '#1ca8c9');
  assert.equal(hawaii.cloudColorHex.toLowerCase(), '#ffffff');

  const dungeon = getWeatherAtmosphere(clear, 'mixed', 0.28, 'dark_dungeon');
  assert.ok(dungeon.fogDensity >= 0.02);
  assert.ok(dungeon.sunIntensityMult < 0.45);
});

