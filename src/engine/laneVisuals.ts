/**
 * Shared lane → arrow-direction mapping so the canvas receptors/notes and the on-screen pad
 * buttons speak the same DDR visual language (the pad under a lane shows that lane's arrow).
 */

export type ArrowDir = 'left' | 'down' | 'up' | 'right' | 'upleft' | 'upright';

// DDR / DDR-Solo panel layouts by lane count.
const DIR_BY_LANES: Record<number, ArrowDir[]> = {
  1: ['up'],
  2: ['left', 'right'],
  3: ['left', 'up', 'right'],
  4: ['left', 'down', 'up', 'right'],
  5: ['left', 'upleft', 'up', 'upright', 'right'],
};

export function laneDir(laneCount: number, lane: number): ArrowDir {
  const arr = DIR_BY_LANES[laneCount] ?? DIR_BY_LANES[4];
  return arr[lane] ?? 'up';
}

/** Rotation (degrees) applied to an up-pointing arrow to face each direction. */
export const DIR_DEG: Record<ArrowDir, number> = {
  up: 0,
  down: 180,
  left: -90,
  right: 90,
  upleft: -45,
  upright: 45,
};

/** Up-pointing arrow silhouette in a -50..50 viewBox — the exact in-game arrow shape. */
export const ARROW_PATH = 'M0,-46 L46,2 L22,2 L22,42 L-22,42 L-22,2 L-46,2 Z';
