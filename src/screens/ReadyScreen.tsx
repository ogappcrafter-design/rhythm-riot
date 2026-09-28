import { useApp } from '../state/appContext';
import { TRACKS_BY_ID } from '../data/tracks';
import { PALETTES } from '../data/palettes';
import type { Difficulty } from '../engine/chartTypes';
import { getBest } from '../state/storage';
import { rgbCss } from '../engine/colors';
import { DifficultyGem, ScreenHeader, StarRow } from '../components/ui';
import { WordArt } from '../components/WordArt';
import { IconPlay } from '../components/icons';
import { sfx } from '../audio/sfx';

const LANE_COUNT: Record<Difficulty, number> = { easy: 3, medium: 4, hard: 4, expert: 5 };
const DIFF_NAME: Record<Difficulty, string> = {
  easy: 'EASY',
  medium: 'MEDIUM',
  hard: 'HARD',
  expert: 'EXPERT',
};

export function ReadyScreen({ trackId, difficulty }: { trackId: string; difficulty: Difficulty }) {
  const { navigate, goBack } = useApp();
  const track = TRACKS_BY_ID[trackId];
  const pal = PALETTES[track.paletteKey];
  const best = getBest(trackId, difficulty);
  const lanes = LANE_COUNT[difficulty];
  const accent: [string, string, string] = ['#ffffff', rgbCss(pal.high.note), rgbCss(pal.high.glow)];

  return (
    <div className="screen">
      <ScreenHeader title="READY" onBack={() => { sfx.play('uiBack'); goBack(); }} colors={accent} />

      <div className="stack center" style={{ flex: 1, justifyContent: 'center', gap: 18 }}>
        <div style={{ height: 46, width: '100%' }}>
          <WordArt text={track.title} size={30} colors={accent} tilt={-3} fitHeight />
        </div>

        <DifficultyGem diff={difficulty} active size={64} />
        <div style={{ height: 34, width: '100%' }}>
          <WordArt text={DIFF_NAME[difficulty]} size={22} colors={accent} tilt={0} fitHeight />
        </div>

        {/* Lane preview */}
        <div className="lane-preview card" style={{ '--lanes': lanes } as React.CSSProperties}>
          {Array.from({ length: lanes }).map((_, i) => (
            <div key={i} className="lane-preview-col">
              <span className="preview-note" style={{ background: rgbCss(pal.high.note), animationDelay: `${i * 0.12}s` }} />
              <span className="preview-pad" style={{ borderColor: rgbCss(pal.high.glow) }} />
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: '12px 18px', textAlign: 'center' }}>
          {best ? (
            <>
              <div className="subtle">Your best · {DIFF_NAME[difficulty]}</div>
              <div className="row center" style={{ gap: 14, marginTop: 6 }}>
                <div style={{ fontSize: 26, fontWeight: 900 }}>{best.score.toLocaleString()}</div>
                <div className="pill">{best.grade}</div>
                <div className="pill">{best.accuracy.toFixed(1)}%</div>
              </div>
              <div style={{ marginTop: 6 }}>
                <StarRow count={best.stars} size={16} />
              </div>
            </>
          ) : (
            <div className="subtle">No score yet — set the first record.</div>
          )}
        </div>
      </div>

      <button
        className="btn btn-primary btn-block row"
        style={{ justifyContent: 'center', gap: 10, fontSize: 20, padding: 18 }}
        onClick={() => {
          sfx.unlock();
          sfx.play('uiTap');
          navigate({ name: 'game', trackId, difficulty });
        }}
      >
        <IconPlay size={22} color="#fff" /> START
      </button>
    </div>
  );
}
