import { useApp } from '../state/appContext';
import { TRACKS } from '../data/tracks';
import { PALETTES } from '../data/palettes';
import { DIFFICULTY_ORDER, type Difficulty } from '../engine/chartTypes';

const DIFF_INITIAL: Record<Difficulty, string> = { easy: 'E', medium: 'M', hard: 'H', expert: 'X' };
const DIFF_DOT: Record<Difficulty, string> = { easy: '#4ade80', medium: '#38bdf8', hard: '#f472b6', expert: '#f59e0b' };
import { getBest, isExpertUnlocked } from '../state/storage';
import { rgbCss } from '../engine/colors';
import { ScreenHeader } from '../components/ui';
import { WordArt } from '../components/WordArt';
import { TrackCover } from '../components/TrackCover';
import { sfx } from '../audio/sfx';

export function SongSelect() {
  const { navigate, goBack } = useApp();

  const pick = (trackId: string) => {
    sfx.play('uiTap');
    navigate({ name: 'difficulty', trackId });
  };

  return (
    <div className="screen">
      <ScreenHeader title="SELECT TRACK" onBack={() => { sfx.play('uiBack'); goBack(); }} />
      <div className="step-tag">STEP 1 · PICK A SONG</div>
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
            <button
              className="card track-card"
              key={track.id}
              onClick={() => pick(track.id)}
              aria-label={`${track.title} — choose difficulty`}
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

              <div className="song-card-foot">
                <span className="song-card-bests">
                  {DIFFICULTY_ORDER.map((d) => {
                    const b = getBest(track.id, d);
                    return (
                      <span key={d} className={`best-dot${b ? ' has' : ''}`} style={{ ['--bd' as string]: DIFF_DOT[d] }} title={d}>
                        {b ? b.grade : d === 'expert' && !unlocked ? '🔒' : DIFF_INITIAL[d]}
                      </span>
                    );
                  })}
                </span>
                <span className="song-card-go">SELECT ▶</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
