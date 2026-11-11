import { useApp } from '../state/appContext';
import { TRACKS } from '../data/tracks';
import { PALETTES } from '../data/palettes';
import { DIFFICULTY_ORDER, type Difficulty } from '../engine/chartTypes';
import { getBest, isExpertUnlocked } from '../state/storage';
import { rgbCss } from '../engine/colors';
import { DifficultyGem, ScreenHeader, StarRow } from '../components/ui';
import { WordArt } from '../components/WordArt';
import { TrackCover } from '../components/TrackCover';
import { sfx } from '../audio/sfx';

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
        {TRACKS.map((track) => {
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
                <div className="track-cover-frame">
                  <TrackCover trackId={track.id} palette={pal} size={92} />
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ height: 34 }}>
                    <WordArt text={track.title} size={24} align="start" colors={accent} tilt={-3} fitHeight />
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

              <div className="pick-hint" style={{ marginTop: 12 }}>Tap a difficulty to play</div>
              <div className="diff-row">
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
