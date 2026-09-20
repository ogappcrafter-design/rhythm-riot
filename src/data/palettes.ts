/**
 * Per-song color palettes (spec Section 6.3).
 *
 * Each palette defines a LOW-mood and HIGH-mood colorway. The Mood System (engine/moodSystem.ts)
 * interpolates continuously between them based on the live mood value (0..1), which is what makes
 * a great run literally look different from a shaky one.
 *
 * Colors are RGB tuples so the engine can lerp them cheaply without string parsing every frame.
 */
export type RGB = readonly [number, number, number];

export interface MoodColorway {
  /** Deep background base (bottom of the vertical gradient). */
  bgDeep: RGB;
  /** Upper background / horizon glow. */
  bgGlow: RGB;
  /** Primary note / gem fill. */
  note: RGB;
  /** Note trail + hit-zone glow. */
  glow: RGB;
  /** Particle color. */
  particle: RGB;
  /** Lane edge accent. */
  lane: RGB;
}

export interface Palette {
  name: string;
  low: MoodColorway;
  high: MoodColorway;
}

export const PALETTES: Record<string, Palette> = {
  i_dont_care_tonight: {
    name: 'Cool Violet',
    low: {
      bgDeep: [8, 10, 26],
      bgGlow: [30, 28, 66],
      note: [120, 130, 220],
      glow: [90, 110, 210],
      particle: [110, 120, 200],
      lane: [60, 66, 130],
    },
    high: {
      bgDeep: [18, 14, 52],
      bgGlow: [96, 70, 210],
      note: [180, 190, 255],
      glow: [150, 130, 255],
      particle: [175, 160, 255],
      lane: [120, 110, 235],
    },
  },
  where_the_inside_opens_wide: {
    name: 'Teal Swing',
    low: {
      bgDeep: [4, 20, 24],
      bgGlow: [12, 52, 60],
      note: [70, 190, 190],
      glow: [60, 170, 180],
      particle: [80, 180, 185],
      lane: [30, 80, 88],
    },
    high: {
      bgDeep: [6, 40, 46],
      bgGlow: [70, 220, 235],
      note: [200, 255, 255],
      glow: [140, 250, 255],
      particle: [190, 250, 255],
      lane: [90, 210, 225],
    },
  },
  who_moved_the_moon: {
    name: 'Moonlit Indigo',
    low: {
      bgDeep: [10, 12, 30],
      bgGlow: [26, 30, 60],
      note: [150, 158, 200],
      glow: [130, 140, 190],
      particle: [160, 168, 205],
      lane: [58, 62, 96],
    },
    high: {
      bgDeep: [20, 22, 52],
      bgGlow: [120, 130, 190],
      note: [225, 230, 250],
      glow: [200, 210, 250],
      particle: [220, 226, 250],
      lane: [140, 150, 210],
    },
  },
  dub_steps_trip: {
    name: 'Neon Drop',
    low: {
      bgDeep: [16, 6, 22],
      bgGlow: [46, 14, 52],
      note: [210, 70, 190],
      glow: [190, 60, 180],
      particle: [200, 80, 190],
      lane: [80, 30, 78],
    },
    high: {
      bgDeep: [26, 8, 34],
      bgGlow: [230, 40, 160],
      note: [90, 255, 140],
      glow: [120, 255, 170],
      particle: [140, 255, 190],
      lane: [200, 60, 170],
    },
  },
  everyday_g: {
    name: 'Adrenaline Amber',
    low: {
      bgDeep: [26, 12, 6],
      bgGlow: [60, 26, 12],
      note: [230, 150, 70],
      glow: [220, 130, 60],
      particle: [235, 160, 80],
      lane: [92, 46, 24],
    },
    high: {
      bgDeep: [40, 12, 6],
      bgGlow: [230, 70, 30],
      note: [255, 210, 120],
      glow: [255, 120, 60],
      particle: [255, 180, 90],
      lane: [230, 90, 40],
    },
  },
};

export const DEFAULT_PALETTE_KEY = 'i_dont_care_tonight';
