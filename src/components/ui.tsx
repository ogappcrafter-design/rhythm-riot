import type { ReactNode } from 'react';
import type { Difficulty } from '../engine/chartTypes';
import { IconBack, IconLock, IconStar } from './icons';
import { WordArt } from './WordArt';

/** A row of stars (filled/empty) for grades. */
export function StarRow({ count, size = 22 }: { count: number; size?: number }) {
  return (
    <div className="row" style={{ gap: 4, justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <IconStar
          key={i}
          size={size}
          filled={i <= count}
          color={i <= count ? '#ffd76a' : 'rgba(255,255,255,0.18)'}
        />
      ))}
    </div>
  );
}

const DIFF_LABEL: Record<Difficulty, string> = {
  easy: 'EASY',
  medium: 'MEDIUM',
  hard: 'HARD',
  expert: 'EXPERT',
};
const DIFF_COLOR: Record<Difficulty, string> = {
  easy: '#4ade80',
  medium: '#38bdf8',
  hard: '#f472b6',
  expert: '#f59e0b',
};

/** A difficulty selector chip. Spells out the full level name (EASY/MEDIUM/HARD/EXPERT) and reads
 *  clearly as a tappable button so it's obvious this is where you pick the song + level. Locked
 *  (Expert before it's earned) shows a padlock. */
export function DifficultyGem({
  diff,
  active,
  locked,
  onClick,
  size = 46,
}: {
  diff: Difficulty;
  active?: boolean;
  locked?: boolean;
  onClick?: () => void;
  size?: number;
}) {
  const color = DIFF_COLOR[diff];
  const h = Math.max(40, size * 0.84);
  return (
    <button
      className={`diff-chip${active ? ' is-active' : ''}`}
      onClick={onClick}
      disabled={locked}
      aria-label={`Play ${diff}${locked ? ' (locked)' : ''}`}
      style={{
        height: h,
        fontSize: Math.max(13, size * 0.3),
        ['--chip' as string]: color,
        borderColor: active ? color : 'rgba(255,255,255,0.16)',
        boxShadow: active ? `0 0 20px ${color}aa` : undefined,
        opacity: locked ? 0.6 : 1,
      }}
    >
      {locked ? <IconLock size={h * 0.44} color="#fff" /> : <span className="diff-chip-dot" aria-hidden />}
      <span className="diff-chip-label">{DIFF_LABEL[diff]}</span>
    </button>
  );
}

/** Big letter-grade badge for the results screen. */
export function GradeBadge({ grade, size = 120 }: { grade: string; size?: number }) {
  const colors: Record<string, [string, string, string]> = {
    S: ['#fff6c9', '#ffd76a', '#ff8a3c'],
    A: ['#d6ffe4', '#8bff9b', '#22d3ee'],
    B: ['#d9ecff', '#7cc4ff', '#7c5cff'],
    C: ['#eae0ff', '#b9a3ff', '#7c5cff'],
    D: ['#ffd9df', '#ff9db0', '#ff5d73'],
  };
  return (
    <div style={{ width: size, height: size }}>
      <WordArt text={grade} size={size * 0.82} colors={colors[grade] ?? colors.B} tilt={-6} fitHeight />
    </div>
  );
}

/** Standard screen header: custom back button + word-art title. */
export function ScreenHeader({
  title,
  onBack,
  colors,
  right,
}: {
  title: string;
  onBack?: () => void;
  colors?: [string, string, string];
  right?: ReactNode;
}) {
  return (
    <div className="row" style={{ marginBottom: 16, minHeight: 48 }}>
      {onBack && (
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <IconBack size={22} />
        </button>
      )}
      <div style={{ flex: 1, height: 52 }}>
        <WordArt text={title} size={34} colors={colors} align="middle" fitHeight />
      </div>
      {right ?? (onBack ? <div style={{ width: 44 }} /> : null)}
    </div>
  );
}
