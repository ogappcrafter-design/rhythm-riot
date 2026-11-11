import { useEffect, useState } from 'react';
import { useApp } from '../state/appContext';
import { TRACKS_BY_ID } from '../data/tracks';
import { PALETTES } from '../data/palettes';
import type { RunResult } from '../engine/gameEngine';
import { rgbCss } from '../engine/colors';
import { StarRow } from '../components/ui';
import { GradeStamp, STAMP_IMPACT_MS, gradeLook } from '../components/GradeStamp';
import { TrackCover } from '../components/TrackCover';
import { earnsShine, fineGrade } from '../engine/grading';
import { WordArt } from '../components/WordArt';
import { IconRiotShard } from '../components/icons';
import { sfx } from '../audio/sfx';
import { getProfile } from '../state/storage';
import { encodeChallenge, type Challenge } from '../online/leaderboard';

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
  challenge,
}: {
  result: RunResult;
  isNewRecord: boolean;
  expertJustUnlocked: boolean;
  challenge?: Challenge;
}) {
  const { navigate } = useApp();
  const track = TRACKS_BY_ID[result.trackId];
  const pal = PALETTES[track.paletteKey];
  const accent: [string, string, string] = ['#ffffff', rgbCss(pal.high.note), rgbCss(pal.high.glow)];
  const t = result.totals;
  const [copied, setCopied] = useState(false);
  const beatChallenge = challenge ? t.score > challenge.score : null;

  const shareChallenge = () => {
    const me = getProfile();
    const code = encodeChallenge({
      username: me?.username ?? 'Rival',
      trackId: result.trackId,
      difficulty: result.difficulty,
      score: t.score,
    });
    const text = `Beat my Rhythm Riot score! ${me?.username ?? ''} · ${track.title} (${DIFF_NAME[result.difficulty]}) · ${t.score.toLocaleString()} — challenge code: ${code}`;
    sfx.play('uiTap');
    const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
    if (typeof nav.share === 'function') {
      void nav.share({ text }).catch(() => {});
    } else {
      try { void navigator.clipboard?.writeText(text); } catch { /* ignore */ }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  const fine = fineGrade(result.grade, result.accuracy);
  const look = gradeLook(fine);
  const shine = earnsShine(fine);
  const [landed, setLanded] = useState(false);
  const [shaking, setShaking] = useState(false);
  const score = useCountUp(t.score, 1100, STAMP_IMPACT_MS + 250);
  const vibe = useCountUp(result.vibeScore, 1100, STAMP_IMPACT_MS + 400);
  const totalHits = Math.max(1, t.perfect + t.great + t.good + t.miss);

  const onImpact = () => {
    setLanded(true);
    setShaking(true);
    window.setTimeout(() => setShaking(false), 360);
    if (shine) window.setTimeout(() => sfx.play('fanfare'), 520);
  };

  const rows: { label: string; value: number; color: string }[] = [
    { label: 'PERFECT', value: t.perfect, color: '#8ef0ff' },
    { label: 'GREAT', value: t.great, color: '#8bff9b' },
    { label: 'GOOD', value: t.good, color: '#ffe98a' },
    { label: 'MISS', value: t.miss, color: '#ff5d73' },
  ];

  return (
    <div className={`screen results${shaking ? ' is-shaking' : ''}`}>
      {landed && shine && (
        <div className="confetti" aria-hidden>
          {Array.from({ length: 28 }).map((_, i) => (
            <span key={i} style={{ ['--i' as string]: i, left: `${(i * 37 + 6) % 100}%` }} />
          ))}
        </div>
      )}

      <div className="results-head">
        <div style={{ height: 58 }}>
          <WordArt text="SONG COMPLETE" size={40} colors={accent} fitHeight />
        </div>
        <div className="results-track" style={{ ['--card-accent' as string]: rgbCss(pal.high.glow) }}>
          <TrackCover trackId={track.id} palette={pal} size={40} />
          <span className="results-track-title">{track.title}</span>
          <span className={`results-diff diff-${result.difficulty}`}>{DIFF_NAME[result.difficulty]}</span>
        </div>
      </div>

      <GradeStamp grade={fine} onImpact={onImpact} />

      <div className={`results-stars${landed ? ' is-in' : ''}`}>
        <StarRow count={result.stars} size={30} />
      </div>

      {expertJustUnlocked && (
        <div className="banner unlock-banner">
          <IconRiotShard size={22} color="#ffd76a" /> EXPERT UNLOCKED — you cleared 90% Perfect on Hard!
        </div>
      )}
      {isNewRecord && <div className="banner record-banner">★ NEW RECORD ★</div>}
      {challenge && (
        <div className={`banner ${beatChallenge ? 'record-banner' : 'challenge-lose'}`}>
          {beatChallenge
            ? `⚔️ YOU BEAT ${challenge.username.toUpperCase()}! (${challenge.score.toLocaleString()})`
            : `⚔️ ${challenge.username} still leads — ${challenge.score.toLocaleString()}. Run it back!`}
        </div>
      )}

      <div className="results-scores">
        <div className="score-tile card" style={{ ['--tile' as string]: look.ink }}>
          <div className="score-label">SCORE</div>
          <div className="score-big">{score.toLocaleString()}</div>
          <div className="score-sub">{result.accuracy.toFixed(2)}% · max combo {t.maxCombo}</div>
        </div>
        <div className="score-tile card" style={{ ['--tile' as string]: '#ffd76a' }}>
          <div className="score-label">◆ VIBE</div>
          <div className="score-big">{vibe.toLocaleString()}</div>
          <div className="score-sub">how you rode the song's arc</div>
        </div>
      </div>

      <div className="card breakdown">
        {rows.map((r, i) => (
          <div className="breakdown-row" key={r.label} style={{ ['--row' as string]: r.color }}>
            <span className="breakdown-label">{r.label}</span>
            <span className="breakdown-bar">
              <span
                className="breakdown-fill"
                style={{ width: landed ? `${Math.max(2, (r.value / totalHits) * 100)}%` : '0%', transitionDelay: `${0.25 + i * 0.12}s` }}
              />
            </span>
            <span className="breakdown-val">{r.value}</span>
          </div>
        ))}
      </div>

      <div className="stack" style={{ marginTop: 16 }}>
        <button
          className="btn btn-primary btn-block"
          onClick={() => { sfx.unlock(); sfx.play('uiTap'); navigate({ name: 'game', trackId: result.trackId, difficulty: result.difficulty, challenge }); }}
        >
          Replay
        </button>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-ghost btn-block" style={{ flex: 1 }} onClick={shareChallenge}>
            {copied ? '✓ Copied!' : '⚔️ Challenge'}
          </button>
          <button className="btn btn-ghost btn-block" style={{ flex: 1 }} onClick={() => { sfx.play('uiTap'); navigate({ name: 'leaderboard' }); }}>
            🏆 Ranks
          </button>
        </div>
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

/** Animate a number from 0 to `target` after `delayMs` (ease-out), for the score reveal. */
function useCountUp(target: number, durationMs: number, delayMs: number): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now() + delayMs;
    const step = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - start) / durationMs));
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, delayMs]);
  return v;
}
