import { useRef, useState } from 'react';
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

function orbVars(c1: string, c2: string, og: string): React.CSSProperties {
  return { ['--c1' as string]: c1, ['--c2' as string]: c2, ['--og' as string]: og };
}

/** Animated demo of one mechanic (pure CSS motion). */
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

// ---- hands-on trial -------------------------------------------------------
type TrialTask = { kind: 'tap' | 'hold'; pad: number; instr: string } | { kind: 'slide'; from: number; to: number; instr: string };
const TRIAL: TrialTask[] = [
  { kind: 'tap', pad: 1, instr: 'TAP the glowing pad' },
  { kind: 'hold', pad: 1, instr: 'HOLD the pad until the ring fills' },
  { kind: 'slide', from: 0, to: 2, instr: 'SLIDE — press the left pad and drag to the right' },
];
const HOLD_MS = 950;

function Trial({ onDone }: { onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [state, setState] = useState<'idle' | 'win' | 'hint'>('idle');
  const [hint, setHint] = useState('');
  const [holding, setHolding] = useState(false);

  const padsRef = useRef<HTMLDivElement | null>(null);
  const padEls = useRef<(HTMLDivElement | null)[]>([]);
  const ptr = useRef<number | null>(null);
  const holdTimer = useRef<number | undefined>(undefined);
  const slideOn = useRef(false);
  const won = useRef(false);

  const task = TRIAL[idx];
  const setPad = (i: number, on: boolean) => padEls.current[i]?.classList.toggle('on', on);
  const clearPads = () => padEls.current.forEach((p) => p?.classList.remove('on'));
  const idxFromX = (x: number) => {
    const el = padsRef.current;
    if (!el) return -1;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(2, Math.floor((x - r.left) / (r.width / 3))));
  };

  const win = () => {
    if (won.current) return;
    won.current = true;
    window.clearTimeout(holdTimer.current);
    setHolding(false);
    clearPads();
    ptr.current = null;
    slideOn.current = false;
    setState('win');
    sfx.play('record');
    window.setTimeout(() => {
      if (idx >= TRIAL.length - 1) {
        sfx.play('unlock');
        onDone();
        return;
      }
      won.current = false;
      setIdx((n) => n + 1);
      setState('idle');
    }, 850);
  };
  const fail = (msg: string) => {
    if (won.current) return;
    window.clearTimeout(holdTimer.current);
    setHolding(false);
    clearPads();
    ptr.current = null;
    slideOn.current = false;
    setHint(msg);
    setState('hint');
    window.setTimeout(() => setState((s) => (s === 'hint' ? 'idle' : s)), 1200);
  };

  const onDown = (e: React.PointerEvent) => {
    if (state !== 'idle') return;
    const pad = idxFromX(e.clientX);
    if (pad < 0) return;
    e.preventDefault();
    padsRef.current?.setPointerCapture?.(e.pointerId);
    ptr.current = e.pointerId;
    setPad(pad, true);
    if (task.kind === 'tap') {
      if (pad === task.pad) win();
    } else if (task.kind === 'hold') {
      if (pad === task.pad) {
        setHolding(true);
        holdTimer.current = window.setTimeout(win, HOLD_MS);
      }
    } else if (task.kind === 'slide') {
      if (pad === task.from) slideOn.current = true;
    }
  };
  const onMove = (e: React.PointerEvent) => {
    if (ptr.current !== e.pointerId) return;
    const pad = idxFromX(e.clientX);
    if (task.kind === 'slide' && slideOn.current && state === 'idle') {
      clearPads();
      setPad(pad, true);
      if (pad === task.to) win();
    }
  };
  const onUp = (e: React.PointerEvent) => {
    if (ptr.current !== e.pointerId) return;
    ptr.current = null;
    if (state !== 'idle' || won.current) {
      clearPads();
      return;
    }
    if (task.kind === 'hold') fail('Keep holding until the ring fills!');
    else if (task.kind === 'slide' && slideOn.current) fail('Don’t lift — drag all the way to the end');
    else clearPads();
  };

  return (
    <div className="tut-body">
      <div style={{ height: 40, width: 'min(360px, 86vw)' }}>
        <WordArt text="YOUR TURN" size={30} colors={['#fff', '#b9a3ff', '#7c5cff']} fitHeight />
      </div>
      <div className="try-dots" aria-hidden>
        {TRIAL.map((_, k) => (
          <span key={k} className={k < idx || state === 'win' && k === idx ? 'done' : k === idx ? 'on' : ''} />
        ))}
      </div>

      <div className="try-stage">
        <div className="try-instr">
          {state === 'win' ? 'NICE! ✓' : state === 'hint' ? hint : task.instr}
        </div>
        {task.kind === 'slide' && state === 'idle' && <div className="try-arrow">→</div>}
        <div
          className="try-pads"
          ref={padsRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onLostPointerCapture={onUp}
        >
          {[0, 1, 2].map((p) => {
            const isTarget =
              (task.kind !== 'slide' && task.pad === p) ||
              (task.kind === 'slide' && (task.from === p || task.to === p));
            const cls = ['try-pad'];
            if (isTarget && state === 'idle') cls.push('target');
            if (task.kind === 'slide' && task.from === p) cls.push('start');
            if (task.kind === 'slide' && task.to === p) cls.push('end');
            return (
              <div key={p} ref={(el) => { padEls.current[p] = el; }} className={cls.join(' ')}>
                {task.kind === 'hold' && task.pad === p && (
                  <span key={`${idx}-${holding}`} className={`try-holdring ${holding ? 'filling' : ''}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="tut-text" style={{ marginTop: 14 }}>Give each one a try — you’ll do all three in real songs.</p>
    </div>
  );
}

function VolumeStep() {
  return (
    <div className="tut-body">
      <div className="vol-icon" aria-hidden>
        <svg viewBox="0 0 64 64" width="92" height="92">
          <path d="M8 24 h10 l14 -11 v38 l-14 -11 H8 z" fill="url(#vg)" />
          <path d="M40 20 a16 16 0 0 1 0 24" fill="none" stroke="#8ef0ff" strokeWidth="4" strokeLinecap="round" className="vwave vw1" />
          <path d="M46 13 a26 26 0 0 1 0 38" fill="none" stroke="#b9a3ff" strokeWidth="4" strokeLinecap="round" className="vwave vw2" />
          <defs>
            <linearGradient id="vg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#b9a3ff" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div style={{ height: 46, width: 'min(400px, 88vw)', marginTop: 10 }}>
        <WordArt text="TURN IT UP" size={34} colors={['#fff', '#8ef0ff', '#22d3ee']} fitHeight />
      </div>
      <p className="tut-text">
        Rhythm Riot is built to be felt. Turn your volume up — or grab headphones — so you can lock onto the beat.
      </p>
    </div>
  );
}

export function TutorialScreen() {
  const { navigate } = useApp();
  const [phase, setPhase] = useState<'learn' | 'try' | 'volume'>('learn');
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const lastLearn = i === STEPS.length - 1;

  const finish = () => {
    sfx.play('uiTap');
    markTutorialSeen();
    navigate({ name: 'menu' });
  };
  const next = () => {
    sfx.play('uiTap');
    if (phase === 'learn') {
      if (lastLearn) setPhase('try');
      else setI((n) => n + 1);
    } else if (phase === 'volume') {
      finish();
    }
  };
  const back = () => {
    sfx.play('uiBack');
    if (phase === 'volume') return setPhase('try');
    if (phase === 'try') return setPhase('learn');
    if (i > 0) setI((n) => n - 1);
  };

  return (
    <div className="screen center" style={{ justifyContent: 'space-between' }}>
      <div className="row" style={{ width: '100%', justifyContent: 'space-between' }}>
        <div className="faint" style={{ letterSpacing: '0.18em' }}>HOW TO PLAY</div>
        <button className="pill" onClick={finish} aria-label="Skip tutorial">SKIP</button>
      </div>

      {phase === 'learn' && (
        <div className="tut-body">
          <Demo key={step.kind} kind={step.kind} />
          <div style={{ height: 46, width: 'min(380px, 86vw)', marginTop: 20 }}>
            <WordArt text={step.title} size={34} colors={step.colors} fitHeight />
          </div>
          <p className="tut-text">{step.body}</p>
        </div>
      )}
      {phase === 'try' && <Trial onDone={() => setPhase('volume')} />}
      {phase === 'volume' && <VolumeStep />}

      <div style={{ width: 'min(420px, 90vw)' }}>
        {phase === 'learn' && (
          <div className="tut-dots" aria-hidden>
            {STEPS.map((_, k) => (
              <span key={k} className={k === i ? 'on' : ''} />
            ))}
          </div>
        )}
        {phase !== 'try' && (
          <div className="row" style={{ gap: 12, marginTop: 14 }}>
            <button
              className="btn btn-ghost"
              style={{ flex: 1, opacity: phase === 'learn' && i === 0 ? 0.4 : 1 }}
              onClick={back}
              disabled={phase === 'learn' && i === 0}
            >
              Back
            </button>
            <button className="btn btn-primary row" style={{ flex: 2, justifyContent: 'center', gap: 8 }} onClick={next}>
              {phase === 'volume' ? (<><IconPlay size={18} color="#fff" /> Let’s Play</>) : 'Next'}
            </button>
          </div>
        )}
        {phase === 'try' && (
          <div className="faint center" style={{ marginTop: 14 }}>Finish all three to continue</div>
        )}
      </div>
    </div>
  );
}
