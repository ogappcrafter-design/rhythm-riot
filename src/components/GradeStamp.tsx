import { useEffect, useId, useState } from 'react';
import { WordArt } from './WordArt';
import { earnsShine, type FineGrade } from '../engine/grading';
import { sfx } from '../audio/sfx';

/**
 * The results-screen rank stamp. A circular rubber stamp (worn ink, double ring, lettering around
 * the rim) with the grade in 3D lettering, that slams down onto the page — squash, screen shake,
 * ink splash, thud. For C+ and better, comic-book shine lines then burst out and pulse around it.
 *
 * Everything lives inside a fixed square "stamp zone", so the shine lines can never overlap any
 * other UI on the screen.
 */

interface GradeLook {
  face: [string, string, string];
  ink: string;
  label: string;
}

const LOOKS: Record<string, Omit<GradeLook, 'label'>> = {
  S: { face: ['#fffbe0', '#ffe07a', '#ff9d2e'], ink: '#ffb347' },
  A: { face: ['#eafff4', '#7dffb8', '#18c98a'], ink: '#3fe0a0' },
  B: { face: ['#e6f6ff', '#8fd6ff', '#2a8cff'], ink: '#38b6ff' },
  C: { face: ['#f3eaff', '#c9a6ff', '#8a4dff'], ink: '#b06bff' },
  D: { face: ['#ffe3e8', '#ff8fa3', '#e0244a'], ink: '#ff4d6a' },
};

const LABELS: Record<FineGrade, string> = {
  S: 'FLAWLESS',
  'A+': 'AWESOME',
  A: 'AWESOME',
  'A-': 'GREAT RUN',
  'B+': 'SOLID',
  B: 'SOLID',
  'B-': 'SOLID',
  'C+': 'NICE',
  C: 'CLEARED',
  'C-': 'CLEARED',
  D: 'KEEP AT IT',
};

export function gradeLook(g: FineGrade): GradeLook {
  return { ...LOOKS[g[0]], label: LABELS[g] };
}

/** When (ms after mount) the stamp hits the page. Kept in sync with the CSS keyframes. */
export const STAMP_IMPACT_MS = 860;

export function GradeStamp({ grade, onImpact }: { grade: FineGrade; onImpact?: () => void }) {
  const id = useId().replace(/:/g, '');
  const look = gradeLook(grade);
  const shine = earnsShine(grade);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => {
      setLanded(true);
      sfx.play('stamp');
      onImpact?.();
    }, STAMP_IMPACT_MS);
    const t2 = shine ? window.setTimeout(() => sfx.play('shine'), STAMP_IMPACT_MS + 380) : 0;
    return () => {
      window.clearTimeout(t1);
      if (t2) window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rim lettering, fitted exactly around the ring with textLength.
  const R_TEXT = 78.5;
  const circ = 2 * Math.PI * R_TEXT;
  const rim = `RHYTHM RIOT • ${look.label} • RANK ${grade} • `;

  // Comic shine: tapered needle lines in the ring between the stamp and the zone edge.
  const lines = Array.from({ length: 16 }, (_, i) => {
    const a = ((i * 360) / 16 + 11.25) * (Math.PI / 180);
    const r1 = 106;
    const r2 = i % 2 ? 136 : 147;
    const w = i % 2 ? 4.5 : 6.5;
    const mid = r1 + (r2 - r1) * 0.38;
    const cx = 150;
    const cy = 150;
    const p = (r: number, off: number) => {
      const px = cx + Math.cos(a) * r - Math.sin(a) * off;
      const py = cy + Math.sin(a) * r + Math.cos(a) * off;
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    };
    return { d: `M${p(r1, 0)} L${p(mid, w)} L${p(r2, 0)} L${p(mid, -w)} Z`, i };
  });
  const sparkles = [
    [44, 52, 7],
    [258, 60, 5.5],
    [252, 246, 7],
    [50, 244, 5.5],
  ];

  return (
    <div className={`stamp-zone${landed ? ' is-landed' : ''}`} style={{ ['--ink' as string]: look.ink }}>
      {shine && (
        <svg className="stamp-shine" viewBox="0 0 300 300" aria-hidden>
          <defs>
            <filter id={`${id}-sg`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g filter={`url(#${id}-sg)`}>
            {lines.map((l) => (
              <path
                key={l.i}
                className="shine-line"
                d={l.d}
                fill="#fff"
                stroke={look.ink}
                strokeWidth="2.2"
                strokeLinejoin="round"
                style={{ animationDelay: `${(STAMP_IMPACT_MS + 260) / 1000}s, ${(STAMP_IMPACT_MS + 760 + l.i * 70) / 1000}s` }}
              />
            ))}
            {sparkles.map(([x, y, s], k) => (
              <path
                key={k}
                className="shine-spark"
                d={`M${x} ${y - s * 2} L${x + s * 0.45} ${y - s * 0.45} L${x + s * 2} ${y} L${x + s * 0.45} ${y + s * 0.45} L${x} ${y + s * 2} L${x - s * 0.45} ${y + s * 0.45} L${x - s * 2} ${y} L${x - s * 0.45} ${y - s * 0.45}Z`}
                fill="#fff"
                stroke={look.ink}
                strokeWidth="1.5"
                style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${(STAMP_IMPACT_MS + 400) / 1000}s, ${(STAMP_IMPACT_MS + 900 + k * 260) / 1000}s` }}
              />
            ))}
          </g>
        </svg>
      )}

      {/* ink splash ring + droplets on impact */}
      <div className="stamp-splat" aria-hidden />
      <div className="stamp-drops" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} style={{ ['--a' as string]: `${i * 36 + 14}deg`, ['--d' as string]: `${74 + (i % 3) * 14}px` }} />
        ))}
      </div>

      <div className="stamp" role="img" aria-label={`Rank ${grade} — ${look.label}`}>
        <svg className="stamp-ring" viewBox="0 0 200 200" aria-hidden>
          <defs>
            <filter id={`${id}-ink`} x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="3" seed="7" result="n" />
              <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3.2 0 0 0 2.75" result="m" />
              <feComposite in="SourceGraphic" in2="m" operator="in" />
            </filter>
            <path id={`${id}-rim`} d={`M100 ${100 - R_TEXT} A${R_TEXT} ${R_TEXT} 0 1 1 ${100 - 0.01} ${100 - R_TEXT}`} />
            <radialGradient id={`${id}-wash`} cx="0.5" cy="0.45" r="0.6">
              <stop offset="0" stopColor={look.ink} stopOpacity="0.28" />
              <stop offset="1" stopColor={look.ink} stopOpacity="0.08" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="94" fill="rgba(8,6,22,0.86)" />
          <g filter={`url(#${id}-ink)`}>
            <circle cx="100" cy="100" r="68" fill={`url(#${id}-wash)`} />
            <circle cx="100" cy="100" r="91" fill="none" stroke={look.ink} strokeWidth="7" />
            <circle cx="100" cy="100" r="68" fill="none" stroke={look.ink} strokeWidth="3" />
            <text
              fontFamily="Bungee, 'Russo One', sans-serif"
              fontSize="12.5"
              fill={look.ink}
              letterSpacing="0.6"
            >
              <textPath href={`#${id}-rim`} textLength={circ - 6} lengthAdjust="spacing">
                {rim}
              </textPath>
            </text>
          </g>
        </svg>
        <div className="stamp-letter">
          <WordArt text={grade} size={84} colors={look.face} tilt={0} fitHeight />
        </div>
      </div>
    </div>
  );
}
