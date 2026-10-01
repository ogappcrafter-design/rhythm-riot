import { useState } from 'react';
import { useApp } from '../state/appContext';
import { markTutorialSeen } from '../state/storage';
import { WordArt } from '../components/WordArt';
import { IconPlay } from '../components/icons';
import { sfx } from '../audio/sfx';

type Kind = 'tap' | 'hold' | 'slide' | 'groove';

interface Step {
  kind: Kind;
  title: string;
  colors: [string, string, string];
  body: string;
}

const STEPS: Step[] = [
  {
    kind: 'tap',
    title: 'TAP',
    colors: ['#ffffff', '#8ef0ff', '#22d3ee'],
    body: 'Glowing orbs rise up the lanes. Tap the pad in a lane the instant its orb lands in the ring at the top.',
  },
  {
    kind: 'hold',
    title: 'HOLD',
    colors: ['#ffffff', '#b6ffcf', '#46e86e'],
    body: 'Some orbs trail a bar. Press and KEEP your finger down until the whole bar passes the ring. Let go early and it breaks — BAD.',
  },
  {
    kind: 'slide',
    title: 'SLIDE',
    colors: ['#ffffff', '#ffd1a0', '#ff9a3c'],
    body: 'A slide orb travels across the lanes. Press its start, then DRAG your finger along the glowing trail to where it ends — without lifting. Lift or fall behind the orb and it breaks.',
  },
  {
    kind: 'groove',
    title: 'GROOVE',
    colors: ['#ffffff', '#ffe08a', '#ff8a3c'],
    body: 'Clean hits build your combo and fill the GROOVE meter. Keep it high to ride the song — misses drain it. No fail — just chase a better grade.',
  },
];

/** Animated demo of one mechanic (pure CSS motion — no canvas). */
function Demo({ kind }: { kind: Kind }) {
  if (kind === 'tap') {
    return (
      <div className="tut-stage">
        <span className="tut-ring" style={{ left: '50%' }} />
        <span className="glow-orb tut-orb tut-orb-tap" style={orbVars('#38b6ff', '#9ff0ff', 'rgba(80,190,255,.55)')} />
        <span className="tut-pop" style={{ left: '50%' }} />
        <span className="tut-pad" style={{ left: '50%' }} />
      </div>
    );
  }
  if (kind === 'hold') {
    return (
      <div className="tut-stage">
        <span className="tut-ring" style={{ left: '50%' }} />
        <span className="tut-bar tut-bar-hold" style={{ left: '50%' }} />
        <span className="glow-orb tut-orb tut-orb-hold" style={orbVars('#46e86e', '#c3ffb0', 'rgba(110,235,140,.55)')} />
        <span className="tut-finger tut-finger-hold" style={{ left: '50%' }} />
      </div>
    );
  }
  if (kind === 'slide') {
    return (
      <div className="tut-stage">
        <span className="tut-ring" style={{ left: '26%', top: '50px' }} />
        <span className="tut-ring" style={{ left: '74%', top: '92px' }} />
        <span className="tut-trail" />
        <span className="glow-orb tut-orb tut-orb-slidehead" style={orbVars('#ff6a3c', '#ffd1a0', 'rgba(255,120,80,.6)')} />
        <span className="tut-finger tut-finger-slide" />
        <span className="tut-drag">DRAG →</span>
      </div>
    );
  }
  return (
    <div className="tut-stage tut-stage-groove">
      <span className="tut-groove-label">GROOVE</span>
      <span className="tut-groove-bar">
        <span className="tut-groove-fill" />
      </span>
      <span className="glow-orb tut-orb tut-orb-groove" style={orbVars('#ffd23b', '#ffb050', 'rgba(255,210,80,.55)')} />
    </div>
  );
}

function orbVars(c1: string, c2: string, og: string): React.CSSProperties {
  return { ['--c1' as string]: c1, ['--c2' as string]: c2, ['--og' as string]: og };
}

export function TutorialScreen() {
  const { navigate } = useApp();
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const finish = () => {
    sfx.play('uiTap');
    markTutorialSeen();
    navigate({ name: 'menu' });
  };
  const next = () => {
    if (last) return finish();
    sfx.play('uiTap');
    setI((n) => n + 1);
  };
  const back = () => {
    if (i === 0) return;
    sfx.play('uiBack');
    setI((n) => n - 1);
  };

  return (
    <div className="screen center" style={{ justifyContent: 'space-between' }}>
      <div className="row" style={{ width: '100%', justifyContent: 'space-between' }}>
        <div className="faint" style={{ letterSpacing: '0.18em' }}>HOW TO PLAY</div>
        <button className="pill" onClick={finish} aria-label="Skip tutorial">SKIP</button>
      </div>

      <div className="tut-body">
        <Demo key={step.kind} kind={step.kind} />
        <div style={{ height: 46, width: 'min(380px, 86vw)', marginTop: 20 }}>
          <WordArt text={step.title} size={34} colors={step.colors} fitHeight />
        </div>
        <p className="tut-text">{step.body}</p>
      </div>

      <div style={{ width: 'min(420px, 90vw)' }}>
        <div className="tut-dots" aria-hidden>
          {STEPS.map((_, k) => (
            <span key={k} className={k === i ? 'on' : ''} />
          ))}
        </div>
        <div className="row" style={{ gap: 12, marginTop: 14 }}>
          <button className="btn btn-ghost" style={{ flex: 1, opacity: i === 0 ? 0.4 : 1 }} onClick={back} disabled={i === 0}>
            Back
          </button>
          <button className="btn btn-primary row" style={{ flex: 2, justifyContent: 'center', gap: 8 }} onClick={next}>
            {last ? (<><IconPlay size={18} color="#fff" /> Let’s Play</>) : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
