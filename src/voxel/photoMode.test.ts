import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PHOTO_DOF,
  clampAperture,
  clampFocusDistance,
  stepAutoFocusDistance,
} from './photoMode';

test('clampFocusDistance clamps values between 2.0 and 48.0 world blocks', () => {
  assert.equal(clampFocusDistance(0.2), 2.0);
  assert.equal(clampFocusDistance(120), 48.0);
  assert.equal(clampFocusDistance(12.5), 12.5);
  assert.equal(clampFocusDistance(Number.NaN), 9.0);
});

test('clampAperture constrains BokehPass aperture within sharp-to-cinematic bounds', () => {
  assert.equal(clampAperture(0.00001), 0.0004);
  assert.equal(clampAperture(0.05), 0.0045);
  assert.equal(clampAperture(DEFAULT_PHOTO_DOF.aperture), DEFAULT_PHOTO_DOF.aperture);
});

test('stepAutoFocusDistance smoothly converges toward target distance or fallback skyline', () => {
  let focus = 9.0;
  for (let i = 0; i < 40; i++) {
    focus = stepAutoFocusDistance(focus, 18.0, 0.05);
  }
  assert.ok(Math.abs(focus - 18.0) < 0.05);

  const skyStep = stepAutoFocusDistance(6.0, null, 0.05);
  assert.ok(skyStep > 6.0 && skyStep < 24.0);
});
