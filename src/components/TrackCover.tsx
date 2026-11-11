import { useId } from 'react';
import type { ReactNode } from 'react';
import type { Palette } from '../data/palettes';
import { rgbCss } from '../engine/colors';

/**
 * Original per-song "album art": a neon synthwave scene in the song's own palette (sky gradient,
 * glowing horizon, perspective floor grid, gloss) with a hand-built neon motif for that track.
 * Pure SVG — crisp at any size, zero image weight.
 */

type MotifFn = (accent: string, glow: string, ids: { glow: string }) => ReactNode;

const spiral = (() => {
  const pts: string[] = [];
  for (let i = 0; i <= 140; i++) {
    const a = i * 0.19;
    const r = 1.2 + i * 0.16;
    pts.push(`${(50 + Math.cos(a) * r).toFixed(2)},${(42 + Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join(' L')}`;
})();

const MOTIFS: Record<string, MotifFn> = {
  // vinyl record
  i_dont_care_tonight: (accent) => (
    <g>
      <circle cx="50" cy="42" r="23" fill="#0b0918" stroke="#fff" strokeWidth="1.6" />
      {[19, 16, 13].map((r) => (
        <circle key={r} cx="50" cy="42" r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.8" />
      ))}
      <circle cx="50" cy="42" r="8" fill={accent} stroke="#fff" strokeWidth="1" />
      <circle cx="50" cy="42" r="1.6" fill="#0b0918" />
      <path d="M33 30 A20 20 0 0 1 46 22.5" stroke="rgba(255,255,255,0.8)" strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
  ),
  // opening portal rings
  where_the_inside_opens_wide: (accent) => (
    <g fill="none">
      {[24, 18, 12, 6].map((r, i) => (
        <ellipse key={r} cx="50" cy="42" rx={r} ry={r * 0.9} stroke={i % 2 ? accent : '#fff'} strokeWidth={2.6 - i * 0.4} opacity={0.55 + i * 0.15} />
      ))}
      <circle cx="50" cy="42" r="3" fill="#fff" />
    </g>
  ),
  // crescent moon + stars
  who_moved_the_moon: (accent, _g, ids) => (
    <g>
      <defs>
        <mask id={`${ids.glow}-m`}>
          <rect width="100" height="100" fill="#fff" />
          <circle cx="58" cy="35" r="17" fill="#000" />
        </mask>
      </defs>
      <circle cx="49" cy="42" r="21" fill="#fff" mask={`url(#${ids.glow}-m)`} />
      {[
        [72, 22, 3],
        [78, 44, 2],
        [28, 20, 2.2],
      ].map(([x, y, s]) => (
        <path key={`${x}`} d={`M${x} ${y - s * 2} L${x + s * 0.5} ${y - s * 0.5} L${x + s * 2} ${y} L${x + s * 0.5} ${y + s * 0.5} L${x} ${y + s * 2} L${x - s * 0.5} ${y + s * 0.5} L${x - s * 2} ${y} L${x - s * 0.5} ${y - s * 0.5}Z`} fill={accent} />
      ))}
    </g>
  ),
  // equalizer bars
  dub_steps_trip: (accent) => (
    <g>
      {[14, 26, 20, 34, 24, 30, 16].map((h, i) => (
        <rect key={i} x={23 + i * 8} y={62 - h} width="6" height={h} rx="2" fill={i % 2 ? accent : '#fff'} />
      ))}
    </g>
  ),
  // lightning bolt
  everyday_g: (accent) => (
    <g>
      <path d="M56 12 L32 46 L47 46 L40 72 L68 34 L52 34 L60 12 Z" fill="#fff" stroke={accent} strokeWidth="2" strokeLinejoin="round" />
    </g>
  ),
  // low-rider with underglow
  badass_underglow: (accent) => (
    <g>
      <ellipse cx="50" cy="60" rx="34" ry="4" fill={accent} opacity="0.9" />
      <path d="M17 52 Q18 46 26 45 L33 37 Q39 32 50 32 L60 32 Q68 33 73 40 L80 44 Q85 46 84 52 L83 55 L18 55 Z" fill="#fff" stroke="#0b0918" strokeWidth="1.2" />
      <path d="M36 38 Q41 35 49 35 L49 43 L32 43 Z M53 35 L60 35 Q66 36 70 42 L53 43 Z" fill="#0b0918" opacity="0.85" />
      <circle cx="31" cy="55" r="6" fill="#0b0918" stroke="#fff" strokeWidth="1.6" />
      <circle cx="70" cy="55" r="6" fill="#0b0918" stroke="#fff" strokeWidth="1.6" />
    </g>
  ),
  // trippy spiral
  you_lick_the_lion: (accent) => (
    <g fill="none" strokeLinecap="round">
      <path d={spiral} stroke={accent} strokeWidth="4.5" opacity="0.55" />
      <path d={spiral} stroke="#fff" strokeWidth="2" />
    </g>
  ),
  // desert sun over a mesa
  take_me_back_west: (accent, _g, ids) => (
    <g>
      <defs>
        <clipPath id={`${ids.glow}-sun`}>
          <circle cx="50" cy="44" r="21" />
        </clipPath>
      </defs>
      <circle cx="50" cy="44" r="21" fill="#fff" />
      <g clipPath={`url(#${ids.glow}-sun)`} fill={accent}>
        {[44, 50, 55, 59].map((y, i) => (
          <rect key={y} x="20" y={y} width="60" height={1.6 + i * 0.6} />
        ))}
      </g>
      <path d="M8 66 L8 56 L22 56 L26 50 L40 50 L44 58 L60 58 L64 52 L78 52 L82 60 L92 60 L92 66 Z" fill="#0b0918" stroke={accent} strokeWidth="1" />
      <path d="M71 52 L71 40 M71 46 L67 46 L67 42 M71 44 L75 44 L75 40" stroke="#0b0918" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </g>
  ),
  // two profiles, face to face
  face_to_face: (accent) => {
    const prof = 'M14 66 L14 18 L30 18 Q37 22 37 30 L41 36 L37 38 Q40 41 37 43 Q40 46 36 48 Q34 53 37 57 L36 66 Z';
    return (
      <g>
        <path d={prof} fill="#fff" stroke="#0b0918" strokeWidth="1" />
        <path d={prof} fill={accent} stroke="#0b0918" strokeWidth="1" transform="translate(100 0) scale(-1 1)" />
      </g>
    );
  },
  // glowing door + $
  money_at_my_door: (accent) => (
    <g>
      <path d="M32 66 L32 22 Q32 16 38 16 L62 16 Q68 16 68 22 L68 66 Z" fill="#0b0918" stroke="#fff" strokeWidth="2" />
      <path d="M50 18 L66 22 L66 64 L50 66 Z" fill={accent} opacity="0.85" />
      <text x="47" y="52" textAnchor="middle" fontFamily="Bungee, 'Russo One', sans-serif" fontSize="26" fill="#fff" stroke="#0b0918" strokeWidth="1.2" paintOrder="stroke">$</text>
      <circle cx="63" cy="43" r="1.6" fill="#fff" />
    </g>
  ),
  // crowned skull
  skull_kings_cadillac: (accent) => (
    <g>
      <path d="M33 26 L37 12 L44 21 L50 8 L56 21 L63 12 L67 26 Z" fill={accent} stroke="#0b0918" strokeWidth="1.2" strokeLinejoin="round" />
      <rect x="33" y="24" width="34" height="5" rx="1.5" fill={accent} stroke="#0b0918" strokeWidth="1.2" />
      <path d="M50 30 C35 30 30 39 31 48 C32 54 36 56 39 57 L39 64 Q39 66 41 66 L59 66 Q61 66 61 64 L61 57 C64 56 68 54 69 48 C70 39 65 30 50 30 Z" fill="#fff" stroke="#0b0918" strokeWidth="1.4" />
      <ellipse cx="42" cy="46" rx="5" ry="5.5" fill="#0b0918" />
      <ellipse cx="58" cy="46" rx="5" ry="5.5" fill="#0b0918" />
      <circle cx="42" cy="46" r="1.4" fill={accent} />
      <circle cx="58" cy="46" r="1.4" fill={accent} />
      <path d="M50 51 L47 56 L53 56 Z" fill="#0b0918" />
      <path d="M44 60 L44 66 M48 60 L48 66 M52 60 L52 66 M56 60 L56 66" stroke="#0b0918" strokeWidth="1.3" />
    </g>
  ),
};

export function TrackCover({ trackId, palette, size = 92 }: { trackId: string; palette: Palette; size?: number }) {
  const id = useId().replace(/:/g, '');
  const ids = { glow: `tc-${id}` };
  const sky = `${ids.glow}-sky`;
  const accent = rgbCss(palette.high.note);
  const glow = rgbCss(palette.high.glow);
  const motif = MOTIFS[trackId] ?? MOTIFS.everyday_g;
  return (
    <svg className="track-cover" viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={rgbCss(palette.low.bgDeep)} />
          <stop offset="0.55" stopColor={rgbCss(palette.high.bgGlow)} />
          <stop offset="0.68" stopColor={rgbCss(palette.high.bgDeep)} />
          <stop offset="1" stopColor="#06040f" />
        </linearGradient>
        <radialGradient id={`${ids.glow}-halo`} cx="0.5" cy="0.42" r="0.45">
          <stop offset="0" stopColor={glow} stopOpacity="0.75" />
          <stop offset="1" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${ids.glow}-gloss`} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
          <stop offset="0.4" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id={ids.glow} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="100" height="100" fill={`url(#${sky})`} />
      <rect width="100" height="100" fill={`url(#${ids.glow}-halo)`} />
      {/* perspective floor grid */}
      <g stroke={glow} strokeWidth="0.7" opacity="0.55">
        {[70, 75, 82, 92].map((y) => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} />
        ))}
        {[-60, -30, -10, 10, 30, 60].map((dx) => (
          <line key={dx} x1={50 + dx * 0.25} y1="67" x2={50 + dx * 1.6} y2="100" />
        ))}
      </g>
      <rect x="0" y="66" width="100" height="1.6" fill={glow} />
      <g filter={`url(#${ids.glow})`}>{motif(accent, glow, ids)}</g>
      <rect width="100" height="100" fill={`url(#${ids.glow}-gloss)`} />
    </svg>
  );
}
