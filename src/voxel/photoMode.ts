export interface PhotoDofSettings {
  enabled: boolean;
  focus: number;
  aperture: number;
  maxblur: number;
  autoFocus: boolean;
}

export const DEFAULT_PHOTO_DOF: PhotoDofSettings = {
  enabled: false,
  focus: 9.0,
  aperture: 0.0016,
  maxblur: 0.016,
  autoFocus: true,
};

export function clampFocusDistance(focus: number): number {
  if (!Number.isFinite(focus)) return 9.0;
  return Math.max(2.0, Math.min(48.0, focus));
}

export function clampAperture(aperture: number): number {
  if (!Number.isFinite(aperture)) return DEFAULT_PHOTO_DOF.aperture;
  return Math.max(0.0004, Math.min(0.0045, aperture));
}

/**
 * Smoothly damps DOF focal plane toward the raycasted target distance.
 */
export function stepAutoFocusDistance(
  currentFocus: number,
  hitDistance: number | null,
  dt: number
): number {
  const target = clampFocusDistance(hitDistance !== null ? hitDistance : 24.0);
  const alpha = 1 - Math.exp(-8.5 * Math.max(0.001, dt));
  return currentFocus + (target - currentFocus) * alpha;
}
