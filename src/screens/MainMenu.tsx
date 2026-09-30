import { useApp } from '../state/appContext';
import { WordArt } from '../components/WordArt';
import { IconChart, IconHelp, IconPlay, IconRiotShard, IconSettings } from '../components/icons';
import { TRACKS } from '../data/tracks';
import { sfx } from '../audio/sfx';

/** Home / Main Menu (spec 8.1). Play, Song Select, Settings, Help. */
export function MainMenu() {
  const { navigate } = useApp();
  const tap = (r: Parameters<typeof navigate>[0]) => {
    sfx.play('uiTap');
    navigate(r);
  };

  return (
    <div className="screen center" style={{ justifyContent: 'center', gap: 26 }}>
      <div className="menu-logo">
        <div className="menu-mark">
          <IconRiotShard size={54} color="#7c5cff" />
        </div>
        <WordArt text="RHYTHM" size={58} tilt={-5} colors={['#ffffff', '#b9a3ff', '#7c5cff']} />
        <WordArt text="RIOT" size={78} tilt={-5} colors={['#ffffff', '#8ef0ff', '#22d3ee']} />
        <div className="eq" aria-hidden>
          {[0.15, 0.45, 0.25, 0.6, 0.35, 0.5, 0.2].map((d, i) => (
            <span key={i} style={{ animationDelay: `${d}s`, animationDuration: `${0.7 + (i % 3) * 0.25}s` }} />
          ))}
        </div>
      </div>

      <div className="stack" style={{ width: 'min(420px, 88vw)', marginTop: 8 }}>
        <button className="btn btn-primary btn-block row" style={{ justifyContent: 'center', gap: 10, fontSize: 20, padding: '18px' }} onClick={() => tap({ name: 'songselect' })}>
          <IconPlay size={22} color="#fff" /> PLAY
        </button>
        <button className="btn btn-ghost btn-block" onClick={() => tap({ name: 'profile' })}>
          <span className="row" style={{ justifyContent: 'center', gap: 10 }}>
            <IconChart size={20} /> Profile &amp; Stats
          </span>
        </button>
        <button className="btn btn-ghost btn-block" onClick={() => tap({ name: 'settings' })}>
          <span className="row" style={{ justifyContent: 'center', gap: 10 }}>
            <IconSettings size={20} /> Settings
          </span>
        </button>
        <button className="btn btn-ghost btn-block" onClick={() => tap({ name: 'help' })}>
          <span className="row" style={{ justifyContent: 'center', gap: 10 }}>
            <IconHelp size={20} /> How to Play
          </span>
        </button>
        <button className="btn btn-ghost btn-block" onClick={() => tap({ name: 'calibration' })}>
          Calibrate Latency
        </button>
      </div>

      <div className="faint" style={{ marginTop: 10 }}>v1 · {TRACKS.length} tracks · drive the Mood Meter</div>
    </div>
  );
}
