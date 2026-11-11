import { useId } from 'react';
import { DISPLAY_FONT } from './WordArt';

/**
 * The Rhythm Riot title logo — a designed lockup, not two lines of styled text.
 *
 *  RHYTHM  → 80s mirror chrome (sky → hard horizon band → ground reflection), deep blue 3D
 *            extrusion, heavy ink outline, and a light sweep that glints across the metal.
 *  RIOT    → bigger, sunset gradient, deep magenta extrusion, wrapped in a neon tube that
 *            flickers on, set over a banded retro sun.
 *  Sparkle glints twinkle on the letter corners.
 *
 * `animated` plays the entrance (slam / punch / sun-rise / neon flicker-on); the menu uses the
 * static lockup with only the idle shimmer.
 */
export function TitleLogo({ animated = true, className }: { animated?: boolean; className?: string }) {
  const id = useId().replace(/:/g, '');
  const k = (s: string) => `tl-${s}-${id}`;
  const W = 400;
  const H = 300;

  // Extrusion depth (stacked slabs read as one solid).
  const slabs = (n: number, dx: number, dy: number) => Array.from({ length: n }, (_, i) => n - i).map((i) => [i * dx, i * dy] as const);

  const sparkle = (x: number, y: number, s: number, delay: number) => (
    <g key={`${x}-${y}`} className="tl-spark" style={{ animationDelay: `${delay}s`, transformOrigin: `${x}px ${y}px` }}>
      <circle cx={x} cy={y} r={s * 3.2} fill={`url(#${k('halo')})`} />
      <path
        d={`M${x} ${y - s * 2.4} Q${x} ${y} ${x + s * 2.4} ${y} Q${x} ${y} ${x} ${y + s * 2.4} Q${x} ${y} ${x - s * 2.4} ${y} Q${x} ${y} ${x} ${y - s * 2.4}Z`}
        fill="#fff"
      />
    </g>
  );

  return (
    <svg
      className={`title-logo${animated ? ' is-animated' : ''}${className ? ` ${className}` : ''}`}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Rhythm Riot"
    >
      <defs>
        {/* 80s chrome: bright sky, hard dark horizon, glowing ground reflection */}
        <linearGradient id={k('chrome')} x1="0" y1="52" x2="0" y2="118" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.3" stopColor="#d6e4ff" />
          <stop offset="0.49" stopColor="#7d8fe0" />
          <stop offset="0.5" stopColor="#1a1d5c" />
          <stop offset="0.6" stopColor="#3a3f9a" />
          <stop offset="0.82" stopColor="#c8d6ff" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id={k('sunset')} x1="0" y1="150" x2="0" y2="250" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff8c4" />
          <stop offset="0.3" stopColor="#ffd23b" />
          <stop offset="0.58" stopColor="#ff7a3c" />
          <stop offset="0.82" stopColor="#ff2d7a" />
          <stop offset="1" stopColor="#c0127a" />
        </linearGradient>
        <linearGradient id={k('sun')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe24a" />
          <stop offset="0.5" stopColor="#ff7a4d" />
          <stop offset="1" stopColor="#ff2d7a" />
        </linearGradient>
        <mask id={k('bands')}>
          <rect x="0" y="0" width={W} height={H} fill="#fff" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <rect key={i} x="0" y={146 + i * 15 + i * i * 0.5} width={W} height={2.5 + i * 1.7} fill="#000" />
          ))}
        </mask>
        <linearGradient id={k('sheen')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={k('halo')}>
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="0.35" stopColor="#ffb8f0" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ff4fd8" stopOpacity="0" />
        </radialGradient>
        <filter id={k('glow')} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={k('bloom')} x="-30%" y="-40%" width="160%" height="180%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <text id={k('t1')} x={W / 2} y="112" textAnchor="middle" fontFamily={DISPLAY_FONT} fontSize="76" letterSpacing="1">
          RHYTHM
        </text>
        <text id={k('t2')} x={W / 2} y="246" textAnchor="middle" fontFamily={DISPLAY_FONT} fontSize="118" letterSpacing="2">
          RIOT
        </text>
        <clipPath id={k('c1')}>
          <use href={`#${k('t1')}`} />
        </clipPath>
        <clipPath id={k('c2')}>
          <use href={`#${k('t2')}`} />
        </clipPath>
      </defs>

      {/* retro sun behind RIOT */}
      <g className="tl-sun">
        <circle cx={W / 2} cy="140" r="132" fill="#ff5a8a" opacity="0.32" filter={`url(#${k('bloom')})`} />
        <circle cx={W / 2} cy="140" r="122" fill={`url(#${k('sun')})`} mask={`url(#${k('bands')})`} />
      </g>

      {/* ---------- RHYTHM — chrome ---------- */}
      <g className="tl-rhythm" transform={`translate(${W / 2} 90) skewX(-8) translate(${-W / 2} -90)`}>
        <use href={`#${k('t1')}`} fill="#7c5cff" opacity="0.55" filter={`url(#${k('bloom')})`} />
        {/* back outline + extrusion */}
        <use href={`#${k('t1')}`} transform="translate(5 11)" fill="#06041a" stroke="#06041a" strokeWidth="12" strokeLinejoin="round" />
        {slabs(10, 0.5, 1.05).map(([dx, dy]) => (
          <use key={dy} href={`#${k('t1')}`} transform={`translate(${dx} ${dy})`} fill="#2b2f8a" stroke="#2b2f8a" strokeWidth="7" strokeLinejoin="round" />
        ))}
        <use href={`#${k('t1')}`} transform="translate(2.5 5.5)" fill="#121548" opacity="0.6" />
        {/* face */}
        <use href={`#${k('t1')}`} fill="none" stroke="#06041a" strokeWidth="9" strokeLinejoin="round" />
        <use href={`#${k('t1')}`} fill={`url(#${k('chrome')})`} />
        <use href={`#${k('t1')}`} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
        {/* light sweep across the metal */}
        <g clipPath={`url(#${k('c1')})`}>
          <rect className="tl-sweep" x="-160" y="40" width="90" height="90" fill={`url(#${k('sheen')})`} transform="skewX(-25)" />
        </g>
      </g>

      {/* ---------- RIOT — sunset + neon tube ---------- */}
      <g className="tl-riot" transform={`translate(${W / 2} 210) skewX(-8) translate(${-W / 2} -210)`}>
        <use href={`#${k('t2')}`} fill="#ff2d7a" opacity="0.5" filter={`url(#${k('bloom')})`} />
        <use href={`#${k('t2')}`} transform="translate(7 15)" fill="#06041a" stroke="#06041a" strokeWidth="14" strokeLinejoin="round" />
        {slabs(13, 0.55, 1.1).map(([dx, dy]) => (
          <use key={dy} href={`#${k('t2')}`} transform={`translate(${dx} ${dy})`} fill="#8a0f5a" stroke="#8a0f5a" strokeWidth="8" strokeLinejoin="round" />
        ))}
        <use href={`#${k('t2')}`} transform="translate(3.5 7.5)" fill="#3d0428" opacity="0.6" />
        <use href={`#${k('t2')}`} fill="none" stroke="#06041a" strokeWidth="11" strokeLinejoin="round" />
        <use href={`#${k('t2')}`} fill={`url(#${k('sunset')})`} />
        {/* glossy top half */}
        <g clipPath={`url(#${k('c2')})`}>
          <rect x="0" y="140" width={W} height="52" fill="#fff" opacity="0.28" />
          <rect className="tl-sweep tl-sweep-2" x="-160" y="140" width="100" height="120" fill={`url(#${k('sheen')})`} transform="skewX(-25)" />
        </g>
        {/* neon tube outline that flickers on */}
        <use className="tl-neon" href={`#${k('t2')}`} fill="none" stroke="#ff7ae6" strokeWidth="2.6" strokeLinejoin="round" filter={`url(#${k('glow')})`} />
        <use className="tl-neon" href={`#${k('t2')}`} fill="none" stroke="#fff" strokeWidth="0.9" strokeLinejoin="round" />
      </g>

      {/* sparkle glints */}
      <g className="tl-sparkles">
        {sparkle(62, 58, 5, 1.4)}
        {sparkle(334, 70, 4, 2.1)}
        {sparkle(96, 160, 4.5, 2.7)}
        {sparkle(318, 156, 6, 1.8)}
        {sparkle(286, 252, 4, 3.2)}
      </g>
    </svg>
  );
}
