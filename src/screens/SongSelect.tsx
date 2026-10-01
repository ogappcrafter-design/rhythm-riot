import { useApp } from '../state/appContext';
import { TRACKS } from '../data/tracks';
import { PALETTES, type RGB } from '../data/palettes';
import { DIFFICULTY_ORDER, type Difficulty } from '../engine/chartTypes';
import { getBest, isExpertUnlocked } from '../state/storage';
import { rgbCss } from '../engine/colors';
import { DifficultyGem, ScreenHeader, StarRow } from '../components/ui';
import { WordArt } from '../components/WordArt';
import { IconRiotShard } from '../components/icons';
import { sfx } from '../audio/sfx';

function TrackArt({ low, high, index }: { low: RGB; high: RGB; index: number }) {
  // Original per-track "album art": palette gradient scene + drifting shard motif.
  return (
    <svg viewBox="0 0 120 120" width="84" height="84" style={{ borderRadius: 16, flexShrink: 0 }} aria-hidden>
      <defs>
        <linearGradient id={`ta-${index}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={rgbCss(high)} />
          <stop offset="1" stopColor={rgbCss(low)} />
        </linearGradient>
        <radialGradient id={`tg-${index}`} cx="0.3" cy="0.25" r="0.9">
          <stop offset="0" stopColor="rgba(255,255,255,0.7)" />
          <stop offset="0.5" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill={`url(#ta-${index})`} />
      <rect width="120" height="120" fill={`url(#tg-${index})`} />
      <g transform="translate(60 62)" opacity="0.9">
        <IconRiotShard size={54} color="rgba(255,255,255,0.9)" style={{ transform: 'translate(-27px,-27px)' }} />
      </g>
    </svg>
  );
}

export function SongSelect() {
  const { navigate, goBack } = useApp();

  const pick = (trackId: string, diff: Difficulty) => {
    sfx.play('uiTap');
    navigate({ name: 'ready', trackId, difficulty: diff });
  };

  return (
    <div className="screen">
      <ScreenHeader title="SELECT TRACK" onBack={() => { sfx.play('uiBack'); goBack(); }} />
      <div className="stack fade-mask" style={{ paddingBottom: 20 }}>
        {TRACKS.map((track, i) => {
          const pal = PALETTES[track.paletteKey];
          const unlocked = isExpertUnlocked(track.id);
          const hardBest = getBest(track.id, 'hard');
          const accent: [string, string, string] = [
            '#ffffff',
            rgbCss(pal.high.note),
            rgbCss(pal.high.glow),
          ];
          const anyBest =
            getBest(track.id, 'easy') ||
            getBest(track.id, 'medium') ||
            hardBest ||
            getBest(track.id, 'expert');

          return (
            <div
              className="card track-card"
              key={track.id}
              style={{ padding: 14, ['--card-accent' as string]: rgbCss(pal.high.glow) }}
            >
              {track.explicit && (
                <span className="explicit-badge" title="Explicit language">
                  <span className="explicit-e">E</span> EXPLICIT
                </span>
              )}
              <div className="row" style={{ alignItems: 'stretch', gap: 14 }}>
                <TrackArt low={pal.low.bgGlow} high={pal.high.bgGlow} index={i} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ height: 30 }}>
                    <WordArt text={track.title} size={22} align="start" colors={accent} tilt={-3} fitHeight />
                  </div>
                  <div className="faint" style={{ marginTop: 6 }}>{track.tagline}</div>
                  <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <span className="pill">{Math.round(track.bpm)} BPM</span>
                    <span className="pill">
                      {Math.floor(track.durationSec / 60)}:
                      {String(Math.round(track.durationSec % 60)).padStart(2, '0')}
                    </span>
                    {anyBest && (
                      <span className="pill" style={{ borderColor: rgbCss(pal.high.glow) }}>
                        {anyBest.grade} · {anyBest.score.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="row" style={{ marginTop: 12, gap: 10, justifyContent: 'space-between' }}>
                <div className="row" style={{ gap: 10 }}>
                  {DIFFICULTY_ORDER.map((diff) => {
                    const locked = diff === 'expert' && !unlocked;
                    return (
                      <DifficultyGem
                        key={diff}
                        diff={diff}
                        locked={locked}
                        onClick={() => pick(track.id, diff)}
                      />
                    );
                  })}
                </div>
              </div>

              {!unlocked && (
                <div className="faint" style={{ marginTop: 8 }}>
                  🔒 Expert unlocks at ≥90% Perfect on Hard
                  {hardBest ? ` (best ${hardBest.perfectPercent.toFixed(0)}%)` : ''}
                </div>
              )}
              {hardBest && hardBest.stars > 0 && (
                <div style={{ marginTop: 6 }}>
                  <StarRow count={hardBest.stars} size={16} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
