import { useId } from 'react';

/**
 * Custom SVG word-art for every headline-level text element (spec Section 6.1:
 * "No default/plain text anywhere a title, header, or button label appears").
 *
 * Bungee (bundled arcade-signage display face) built up as real 3D lettering: a stacked
 * extrusion falling down-right in a deep shade of the accent, a dark outline, a vertical gradient
 * face, a glossy top highlight and a soft neon glow behind — like a lit sign, not system text.
 */

export interface WordArtProps {
  text: string;
  /** Visual scale in px (font size). */
  size?: number;
  /** Gradient stops for the face (top → bottom); the last also tints the glow + extrusion. */
  colors?: [string, string, string];
  /** Outline color. */
  stroke?: string;
  /** Degrees of tilt for the "dynamic angle" energy. */
  tilt?: number;
  align?: 'start' | 'middle' | 'end';
  className?: string;
  glow?: boolean;
  /** 3D extrusion depth (0 = flat). Default scales with size. */
  depth?: number;
  /** Fit within BOTH the wrapper's width and height (wrapper must have a definite height).
   *  Prevents short titles from scaling taller than their box and overlapping siblings. */
  fitHeight?: boolean;
}

export const DISPLAY_FONT = "Bungee, 'Russo One', 'Arial Black', system-ui, sans-serif";

let measureCtx: CanvasRenderingContext2D | null = null;
/** Width of `text` in Bungee at `size`px (fonts are preloaded before first render). */
function measure(text: string, size: number): number {
  try {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    if (measureCtx) {
      measureCtx.font = `${size}px ${DISPLAY_FONT}`;
      const w = measureCtx.measureText(text).width;
      if (w > 0) return w;
    }
  } catch {
    /* fall through to estimate */
  }
  return text.length * size * 0.78;
}

export function WordArt({
  text,
  size = 56,
  colors = ['#ffffff', '#b9a3ff', '#22d3ee'],
  stroke = 'rgba(8,6,24,0.95)',
  tilt = -4,
  align = 'middle',
  className,
  glow = true,
  depth,
  fitHeight = false,
}: WordArtProps) {
  const id = useId().replace(/:/g, '');
  const tid = `wa-t-${id}`;
  const gid = `wa-g-${id}`;
  const hid = `wa-h-${id}`;
  const fid = `wa-f-${id}`;

  // Many thin slabs read as one smooth solid extrusion (no visible stair-steps).
  const layers = depth ?? (size >= 40 ? 14 : size >= 24 ? 9 : 5);
  const stepX = (size * 0.075) / Math.max(1, layers);
  const stepY = (size * 0.13) / Math.max(1, layers);
  const textW = measure(text, size);
  const padX = size * 0.45 + layers * stepX;
  const width = textW + padX * 2;
  const height = size * 1.62;
  const anchorX = align === 'start' ? padX : align === 'end' ? width - padX : width / 2;
  const baseY = height * 0.66;
  const par = `${align === 'start' ? 'xMin' : align === 'end' ? 'xMax' : 'xMid'}YMid meet`;
  const outline = size * 0.075;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={fitHeight ? '100%' : undefined}
      preserveAspectRatio={par}
      role="img"
      aria-label={text}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <text
          id={tid}
          x={anchorX}
          y={baseY}
          textAnchor={align}
          fontFamily={DISPLAY_FONT}
          fontSize={size}
          letterSpacing={size * 0.01}
        >
          {text}
        </text>
        <linearGradient id={gid} x1="0" y1={baseY - size * 0.75} x2="0" y2={baseY + size * 0.05} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={colors[0]} />
          <stop offset="0.5" stopColor={colors[1]} />
          <stop offset="1" stopColor={colors[2]} />
        </linearGradient>
        <linearGradient id={hid} x1="0" y1={baseY - size * 0.78} x2="0" y2={baseY - size * 0.3} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="rgba(255,255,255,0.75)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        {glow && (
          <filter id={fid} x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation={size * 0.2} />
          </filter>
        )}
      </defs>
      <g transform={`rotate(${tilt} ${anchorX} ${height / 2}) translate(${anchorX} ${baseY}) skewX(-6) translate(${-anchorX} ${-baseY})`}>
        {/* neon bloom behind everything */}
        {glow && <use href={`#${tid}`} fill={colors[2]} opacity={0.9} filter={`url(#${fid})`} />}
        {/* 3D extrusion: one solid slab in a deep shade of the accent, outlined at its back edge,
            with a lit lip right under the face so the letters read as beveled, not stacked. */}
        <g transform={`translate(${layers * stepX} ${layers * stepY})`}>
          <use href={`#${tid}`} fill={stroke} stroke={stroke} strokeWidth={outline * 2} strokeLinejoin="round" />
        </g>
        {Array.from({ length: layers }, (_, k) => {
          const i = layers - k;
          return (
            <use
              key={i}
              href={`#${tid}`}
              transform={`translate(${i * stepX} ${i * stepY})`}
              fill={i <= 1 ? colors[1] : colors[2]}
              stroke={colors[2]}
              strokeWidth={outline * 0.9}
              strokeLinejoin="round"
            />
          );
        })}
        <g transform={`translate(${layers * stepX * 0.5} ${layers * stepY * 0.5})`} opacity={0.62}>
          <use href={`#${tid}`} fill="#05030f" stroke="#05030f" strokeWidth={outline * 0.9} strokeLinejoin="round" />
        </g>
        {/* face: dark outline, gradient fill, glossy top highlight */}
        <use href={`#${tid}`} fill={`url(#${gid})`} stroke={stroke} strokeWidth={outline} paintOrder="stroke" strokeLinejoin="round" />
        <use href={`#${tid}`} fill={`url(#${hid})`} />
      </g>
    </svg>
  );
}
