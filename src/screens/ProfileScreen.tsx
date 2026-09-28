import { useMemo } from 'react';
import { useApp } from '../state/appContext';
import { computeProfile, formatPlaytime, type TrackProgress } from '../state/profile';
import { PALETTES } from '../data/palettes';
import { DIFFICULTY_ORDER, type Difficulty } from '../engine/chartTypes';
import { rgbCss } from '../engine/colors';
import { ScreenHeader } from '../components/ui';
import { WordArt } from '../components/WordArt';
import { IconLock, IconRiotShard, IconStar, IconTrophy } from '../components/icons';
import { sfx } from '../audio/sfx';

const DIFF_COLOR: Record<Difficulty, string> = {
  easy: '#4ade80',
  medium: '#38bdf8',
  hard: '#f472b6',
  expert: '#f59e0b',
};
const DIFF_SHORT: Record<Difficulty, string> = { easy: 'E', medium: 'M', hard: 'H', expert: 'X' };

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="card stat-tile">
      <div className="stat-value" style={accent ? { color: accent, textShadow: `0 0 14px ${accent}66` } : undefined}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
      {sub && <div className="faint">{sub}</div>}
    </div>
  );
}

function TrackRow({ tp }: { tp: TrackProgress }) {
  const pal = PALETTES[tp.paletteKey];
  const accent: [string, string, string] = ['#ffffff', rgbCss(pal.high.note), rgbCss(pal.high.glow)];
  return (
    <div className="card profile-track">
      <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0, height: 26 }}>
          <WordArt text={tp.title} size={18} align="start" colors={accent} tilt={-2} fitHeight />
        </div>
        <div className="row" style={{ gap: 3 }}>
          <IconStar size={15} filled color="#ffd76a" />
          <span style={{ fontWeight: 800, fontSize: 13 }}>{tp.stars}/20</span>
        </div>
      </div>
      <div className="row profile-diffs" style={{ marginTop: 8, gap: 6 }}>
        {DIFFICULTY_ORDER.map((d) => {
          const b = tp.bests[d];
          const locked = d === 'expert' && !tp.expertUnlocked;
          return (
            <div
              key={d}
              className={`diff-chip ${b ? 'played' : ''}`}
              style={{ borderColor: b ? DIFF_COLOR[d] : 'rgba(255,255,255,0.1)' }}
            >
              <span className="diff-chip-tag" style={{ color: DIFF_COLOR[d] }}>{DIFF_SHORT[d]}</span>
              {b ? (
                <>
                  <span className="diff-chip-grade">{b.grade}</span>
                  <span className="diff-chip-stars">{'★'.repeat(b.stars)}</span>
                </>
              ) : locked ? (
                <IconLock size={14} color="rgba(255,255,255,0.4)" />
              ) : (
                <span className="faint">—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProfileScreen() {
  const { goBack } = useApp();
  const p = useMemo(() => computeProfile(), []);
  const hasPlayed = p.lifetime.runs > 0;

  return (
    <div className="screen">
      <ScreenHeader title="PROFILE" onBack={() => { sfx.play('uiBack'); goBack(); }} colors={['#fff', '#ffd76a', '#ff8a3c']} />

      {/* Rank hero */}
      <div className="card rank-hero">
        <div className="rank-mark">
          <IconTrophy size={40} color="#ffd76a" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ height: 32, width: '100%' }}>
            <WordArt text={p.rank.name.toUpperCase()} size={26} align="start" colors={['#fff', '#ffd76a', '#ff8a3c']} tilt={-3} fitHeight />
          </div>
          <div className="rank-bar">
            <div className="rank-bar-fill" style={{ width: `${Math.round(p.rank.progress * 100)}%` }} />
          </div>
          <div className="faint" style={{ marginTop: 4 }}>
            {p.rank.progress >= 1
              ? 'Max rank — you own this'
              : `${p.rank.starsForNextTier - p.rank.starsIntoTier} ★ to next rank`}
          </div>
        </div>
      </div>

      {!hasPlayed && (
        <div className="card center" style={{ padding: 22, marginTop: 12 }}>
          <IconRiotShard size={36} color="#7c5cff" />
          <div className="subtle" style={{ marginTop: 8, textAlign: 'center' }}>
            No runs yet. Play a track and your stats start stacking up here.
          </div>
        </div>
      )}

      {hasPlayed && (
        <>
          {/* Star completion */}
          <div className="card completion" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 800, letterSpacing: '0.04em' }}>COLLECTION</span>
              <span className="row" style={{ gap: 4 }}>
                <IconStar size={16} filled color="#ffd76a" />
                <b>{p.totalStars}</b><span className="faint">/{p.maxStars}</span>
              </span>
            </div>
            <div className="rank-bar" style={{ marginTop: 8 }}>
              <div className="rank-bar-fill gold" style={{ width: `${(p.totalStars / p.maxStars) * 100}%` }} />
            </div>
          </div>

          {/* Stat grid */}
          <div className="stat-grid">
            <StatTile label="Runs" value={p.lifetime.runs.toLocaleString()} />
            <StatTile label="Notes Hit" value={(p.lifetime.perfect + p.lifetime.great + p.lifetime.good).toLocaleString()} sub={`of ${p.lifetime.notes.toLocaleString()}`} />
            <StatTile label="Perfects" value={p.lifetime.perfect.toLocaleString()} accent="var(--perfect)" />
            <StatTile label="Best Combo" value={p.lifetime.bestCombo.toLocaleString()} accent="var(--accent-2)" />
            <StatTile label="Lifetime Acc." value={`${p.lifetimeAccuracy.toFixed(1)}%`} />
            <StatTile label="Play Time" value={formatPlaytime(p.lifetime.playMs)} />
            <StatTile label="Top Score" value={p.bestScore.toLocaleString()} />
            <StatTile label="Top Vibe" value={p.bestVibe.toLocaleString()} accent="#ffd76a" />
          </div>

          <div className="row" style={{ gap: 10, marginTop: 10 }}>
            <div className="card mini-stat">
              <span className="faint">EXPERT UNLOCKED</span>
              <div style={{ fontWeight: 900, fontSize: 20 }}>{p.expertUnlockedCount}<span className="faint"> / {p.totalTracks}</span></div>
            </div>
            <div className="card mini-stat">
              <span className="faint">TRACKS PLAYED</span>
              <div style={{ fontWeight: 900, fontSize: 20 }}>{p.tracksPlayed}<span className="faint"> / {p.totalTracks}</span></div>
            </div>
          </div>

          {/* Per-track breakdown */}
          <div style={{ height: 30, marginTop: 18, marginBottom: 4 }}>
            <WordArt text="BY TRACK" size={20} align="start" colors={['#fff', '#b9a3ff', '#7c5cff']} fitHeight />
          </div>
          <div className="stack" style={{ paddingBottom: 20 }}>
            {p.tracks.map((tp) => (
              <TrackRow key={tp.trackId} tp={tp} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
