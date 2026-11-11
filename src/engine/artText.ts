/**
 * 3D "art text" for the canvas engine — the same look as the WordArt component: Bungee lettering
 * with a solid extrusion falling down-right, a dark outline, a vertical gradient face, a glossy top
 * highlight and a neon halo. Each label is rendered ONCE into an offscreen canvas and cached, so a
 * frame only pays for drawImage (no per-frame text shaping, no shadowBlur).
 */

export const ART_FONT = "Bungee, 'Russo One', 'Arial Black', system-ui, sans-serif";

export interface ArtTextStyle {
  /** Face gradient top → bottom. */
  top: string;
  mid: string;
  bottom: string;
  /** Neon halo color (omit for none). */
  glow?: string;
  /** Extrusion slab color (shaded dark on top). Defaults to `bottom`. */
  slab?: string;
}

interface Sprite {
  canvas: HTMLCanvasElement;
  /** Size in CSS px. */
  w: number;
  h: number;
}

const cache = new Map<string, Sprite>();
const MAX = 96;

function key(text: string, size: number, s: ArtTextStyle, dpr: number): string {
  return `${text}|${size}|${s.top}|${s.mid}|${s.bottom}|${s.glow ?? ''}|${s.slab ?? ''}|${dpr}`;
}

function build(text: string, size: number, s: ArtTextStyle, dpr: number): Sprite {
  const meas = document.createElement('canvas').getContext('2d')!;
  meas.font = `${size}px ${ART_FONT}`;
  const tw = meas.measureText(text).width;
  const depth = Math.max(2, Math.round(size * 0.11));
  const halo = s.glow ? size * 0.32 : size * 0.08;
  const padX = halo + depth + size * 0.12;
  const padY = halo + depth + size * 0.1;
  const w = Math.ceil(tw + padX * 2);
  const h = Math.ceil(size * 1.05 + padY * 2);
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * dpr);
  cv.height = Math.ceil(h * dpr);
  const c = cv.getContext('2d')!;
  c.scale(dpr, dpr);
  c.font = `${size}px ${ART_FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  const x = w / 2 - depth * 0.3;
  const y = h / 2 - depth * 0.35;

  // Neon halo: stacked soft strokes (rendered once, so cheap enough to be generous).
  if (s.glow) {
    c.strokeStyle = s.glow;
    for (const [lw, a] of [[size * 0.62, 0.08], [size * 0.42, 0.12], [size * 0.26, 0.2]] as const) {
      c.globalAlpha = a;
      c.lineWidth = lw;
      c.strokeText(text, x + depth * 0.5, y + depth * 0.5);
    }
    c.globalAlpha = 1;
  }

  // Extrusion: back outline, then a solid slab of thin layers, shaded.
  const slab = s.slab ?? s.bottom;
  const stepX = 0.55;
  const stepY = 1;
  c.strokeStyle = 'rgba(6,4,18,0.95)';
  c.lineWidth = size * 0.16;
  c.strokeText(text, x + depth * stepX, y + depth * stepY);
  for (let i = depth; i >= 1; i--) {
    c.fillStyle = slab;
    c.fillText(text, x + i * stepX, y + i * stepY);
  }
  c.globalAlpha = 0.55;
  c.fillStyle = '#06041a';
  for (let i = depth; i >= 2; i--) c.fillText(text, x + i * stepX, y + i * stepY);
  c.globalAlpha = 1;

  // Face: dark outline, gradient fill, gloss on the upper half.
  c.strokeStyle = 'rgba(6,4,18,0.95)';
  c.lineWidth = size * 0.12;
  c.strokeText(text, x, y);
  const g = c.createLinearGradient(0, y - size * 0.42, 0, y + size * 0.38);
  g.addColorStop(0, s.top);
  g.addColorStop(0.5, s.mid);
  g.addColorStop(1, s.bottom);
  c.fillStyle = g;
  c.fillText(text, x, y);
  const gl = c.createLinearGradient(0, y - size * 0.45, 0, y);
  gl.addColorStop(0, 'rgba(255,255,255,0.7)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gl;
  c.fillText(text, x, y);

  return { canvas: cv, w, h };
}

/** Draw cached 3D art text centered at (x, y) in CSS px. `size` is rounded to keep the cache small;
 *  use `scale` for animated punch/zoom instead of varying `size`. */
export function drawArtText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  style: ArtTextStyle,
  dpr: number,
  scale = 1,
): void {
  const sz = Math.max(8, Math.round(size / 2) * 2);
  const k = key(text, sz, style, dpr);
  let sp = cache.get(k);
  if (!sp) {
    sp = build(text, sz, style, dpr);
    cache.set(k, sp);
    if (cache.size > MAX) cache.delete(cache.keys().next().value as string);
  }
  const w = sp.w * scale;
  const h = sp.h * scale;
  ctx.drawImage(sp.canvas, x - w / 2, y - h / 2, w, h);
}

/** Ready-made palettes for the judgement words and HUD. */
export const ART = {
  perfect: { top: '#ffffff', mid: '#9ff4ff', bottom: '#22c7f0', glow: '#22d3ee', slab: '#1490c0' },
  great: { top: '#ffffff', mid: '#b6ffbf', bottom: '#3fe07a', glow: '#4ade80', slab: '#1f9a50' },
  good: { top: '#ffffff', mid: '#fff3a6', bottom: '#ffc83a', glow: '#ffc83a', slab: '#c58a10' },
  miss: { top: '#ffd1d8', mid: '#ff6b81', bottom: '#e0244a', glow: '#ff2d55', slab: '#8f0f2a' },
  gold: { top: '#fffbe0', mid: '#ffe07a', bottom: '#ff9d2e', glow: '#ffb347', slab: '#b45a10' },
  violet: { top: '#ffffff', mid: '#cdb8ff', bottom: '#8a63ff', glow: '#7c5cff', slab: '#4a2bb8' },
} satisfies Record<string, ArtTextStyle>;

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((ch) => ch + ch).join('') : h.slice(0, 6);
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const styleCache = new Map<string, ArtTextStyle>();
/** A 3D art-text style built around one accent hex color (white-hot top → accent → deep slab). */
export function artStyleFromHex(hex: string): ArtTextStyle {
  const hit = styleCache.get(hex);
  if (hit) return hit;
  const [r, g, b] = hexRgb(hex);
  const mix = (t: number, to: number) => `rgb(${Math.round(r + (to - r) * t)},${Math.round(g + (to - g) * t)},${Math.round(b + (to - b) * t)})`;
  const s: ArtTextStyle = { top: '#ffffff', mid: mix(0.45, 255), bottom: hex, glow: hex, slab: mix(0.5, 0) };
  styleCache.set(hex, s);
  return s;
}
