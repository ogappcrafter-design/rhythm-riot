import type { MoodColorway, Palette, RGB } from '../data/palettes';

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

export function rgbCss([r, g, b]: RGB, alpha = 1): string {
  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Interpolate an entire colorway between a palette's low and high mood. */
export function moodColorway(p: Palette, moodNorm: number): MoodColorway {
  const t = clamp01(moodNorm);
  return {
    bgDeep: lerpRGB(p.low.bgDeep, p.high.bgDeep, t),
    bgGlow: lerpRGB(p.low.bgGlow, p.high.bgGlow, t),
    note: lerpRGB(p.low.note, p.high.note, t),
    glow: lerpRGB(p.low.glow, p.high.glow, t),
    particle: lerpRGB(p.low.particle, p.high.particle, t),
    lane: lerpRGB(p.low.lane, p.high.lane, t),
  };
}
