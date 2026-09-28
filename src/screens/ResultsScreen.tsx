import { useEffect } from 'react';
import { useApp } from '../state/appContext';
import { TRACKS_BY_ID } from '../data/tracks';
import { PALETTES } from '../data/palettes';
import type { RunResult } from '../engine/gameEngine';
import { rgbCss } from '../engine/colors';
import { GradeBadge, StarRow } from '../components/ui';
import { WordArt } from '../components/WordArt';
import { IconRiotShard } from '../components/icons';
import { sfx } from '../audio/sfx';

const DIFF_NAME: Record<string, string> = {
  easy: 'EASY',
  medium: 'MEDIUM',
  hard: 'HARD',
  expert: 'EXPERT',
};

export function ResultsScreen({
  result,
  isNewRecord,
  expertJustUnlocked,
}: {
  result: RunResult;
  isNewRecord: boolean;
  expertJustUnlocked: boolean;
}) {
  const { navigate } = useApp();
  const track = TRACKS_BY_ID[result.trackId];
  const pal = PALETTES[track.paletteKey];
  const accent: [string, string, string] = ['#ffffff', rgbCss(pal.high.note), rgbCss(pal.high.glow)];
  const t = result.totals;

  useEffect(() => {
    sfx.play('fanfare');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearedLine =
    result.grade === 'S' ? 'FLAWLESS!' : result.grade === 'A' ? 'AWESOME!' : result.grade === 'D' ? 'CLEARED' : 'GREAT JOB!';

  const rows: { label: string; value: number; color: string }[] = [
    { label: 'PERFECT', value: t.perfect, color: 'var(--perfect)' },
    { label: 'GREAT', value: t.great, color: 'var(--great)' },
    { label: 'GOOD', value: t.good, color: 'var(--good)' },
    { label: 'MISS', value: t.miss, color: 'var(--danger)' },
  ];

  return (
    <div className="screen results">
      {/* celebratory burst */}
      <div className="confetti" aria-hidden>
        {Array.from({ length: 28 }).map((_, i) => (
          <span key={i} style={{ ['--i' as string]: i, left: `${(i * 37 + 6) % 100}%` }} />
        ))}
      </div>
      <div className="results-celebrate">
        <div style={{ height: 56 }}>
          <WordArt text="SONG COMPLETE" size={40} colors={accent} fitHeight />
        </div>
        <div style={{ height: 40, marginTop: -6 }}>
          <WordArt
            text={clearedLine}
            size={30}
            colors={result.grade === 'S' || result.grade === 'A' ? ['#fff', '#ffd76a', '#ff8a3c'] : ['#fff', '#8ef0ff', '#22d3ee']}
            fitHeight
          />
        </div>
      </div>
      <div className="subtle center" style={{ marginBottom: 12 }}>
        {track.title} · {DIFF_NAME[result.difficulty]}
      </div>

      {expertJustUnlocked && (
        <div className="banner unlock-banner">
          <IconRiotShard size={22} color="#ffd76a" /> EXPERT UNLOCKED — you cleared 90% Perfect on Hard!
        </div>
      )}
      {isNewRecord && (
        <div className="banner record-banner">★ NEW RECORD</div>
      )}

      <div className="results-grade card">
        <GradeBadge grade={result.grade} size={116} />
        <div style={{ marginTop: 8 }}>
          <StarRow count={result.stars} size={26} />
        </div>
      </div>

      <div className="results-scores">
        <div className="score-tile card">
          <div className="faint">ACCURACY SCORE</div>
          <div className="score-big">{t.score.toLocaleString()}</div>
          <div className="subtle">{result.accuracy.toFixed(2)}% · max combo {t.maxCombo}</div>
        </div>
        <div className="score-tile card vibe-tile">
          <div className="faint" style={{ color: '#ffd76a' }}>◆ VIBE SCORE</div>
          <div className="score-big vibe-val">{result.vibeScore.toLocaleString()}</div>
          <div className="subtle">how well you rode the song's arc</div>
        </div>
      </div>

      <div className="card breakdown">
        {rows.map((r) => (
          <div className="breakdown-row" key={r.label}>
            <span className="breakdown-dot" style={{ background: r.color }} />
            <span className="breakdown-label">{r.label}</span>
            <span className="spacer" />
            <span className="breakdown-val" style={{ color: r.color }}>{r.value}</span>
          </div>
        ))}
      </div>

      <div className="stack" style={{ marginTop: 16 }}>
        <button
          className="btn btn-primary btn-block"
          onClick={() => { sfx.play('uiTap'); navigate({ name: 'ready', trackId: result.trackId, difficulty: result.difficulty }); }}
        >
          Replay
        </button>
        <button
          className="btn btn-ghost btn-block"
          onClick={() => { sfx.play('uiBack'); navigate({ name: 'songselect' }); }}
        >
          Back to Songs
        </button>
      </div>
    </div>
  );
}
