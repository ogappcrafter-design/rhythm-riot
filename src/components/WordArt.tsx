import { useId } from 'react';

/**
 * Custom SVG word-art for every headline-level text element (spec Section 6.1:
 * "No default/plain text anywhere a title, header, or button label appears").
 *
 * Renders heavy condensed-italic type with a gradient fill, an outline stroke and a glow —
 * a designed treatment, not raw system text on a flat background. Rhythm Riot's own identity:
 * a slight upward tilt + shard-cut outline, distinct from the reference games' star/space type.
 */

export interface WordArtProps {
  text: string;
  /** Visual scale in px (cap height-ish). */
  size?: number;
  /** Gradient stops. */
  colors?: [string, string, string];
  /** Outline color. */
  stroke?: string;
  /** Degrees of tilt for the "dynamic angle" energy. */
  tilt?: number;
  align?: 'start' | 'middle' | 'end';
  className?: string;
  glow?: boolean;
}

export function WordArt({
  text,
  size = 56,
  colors = ['#ffffff', '#b9a3ff', '#22d3ee'],
  stroke = 'rgba(10,8,30,0.9)',
  tilt = -4,
  align = 'middle',
  className,
  glow = true,
}: WordArtProps) {
  const id = useId().replace(/:/g, '');
  const gid = `wa-grad-${id}`;
  const fid = `wa-glow-${id}`;

  // Estimate a viewBox from character count so the SVG scales responsively.
  // Arial Black italic caps are wide (~0.62em) + stroke/glow padding — a too-small factor
  // lets glyphs spill past the viewBox and (with overflow visible) off-screen, so pad generously.
  const approxWidth = Math.max(text.length * size * 0.66 + size * 0.8, size * 2.2);
  const height = size * 1.5;
  const anchorX = align === 'start' ? size * 0.35 : align === 'end' ? approxWidth - size * 0.35 : approxWidth / 2;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${approxWidth} ${height}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={text}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={colors[0]} />
          <stop offset="0.55" stopColor={colors[1]} />
          <stop offset="1" stopColor={colors[2]} />
        </linearGradient>
        <filter id={fid} x="-30%" y="-40%" width="160%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation={glow ? size * 0.14 : 0} floodColor={colors[2]} floodOpacity="0.85" />
          <feDropShadow dx="0" dy={size * 0.05} stdDeviation="1" floodColor="rgba(0,0,0,0.6)" floodOpacity="1" />
        </filter>
      </defs>
      <g transform={`rotate(${tilt} ${anchorX} ${height / 2})`} filter={`url(#${fid})`}>
        <text
          x={anchorX}
          y={height * 0.72}
          textAnchor={align}
          fontFamily="'Arial Black', 'Segoe UI', system-ui, sans-serif"
          fontWeight={900}
          fontStyle="italic"
          fontSize={size}
          letterSpacing={size * -0.01}
          stroke={stroke}
          strokeWidth={size * 0.055}
          paintOrder="stroke"
          fill={`url(#${gid})`}
          style={{ transform: 'scaleX(0.92)', transformBox: 'fill-box', transformOrigin: 'center' }}
        >
          {text}
        </text>
      </g>
    </svg>
  );
}
