import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/appContext';
import { markIntroSeen, hasProfile } from '../state/storage';
import { WordArt } from '../components/WordArt';
import { IconRiotShard } from '../components/icons';
import { sfx } from '../audio/sfx';

// Floating energy orbs that echo the in-game note orbs (swirl via a spinning conic gradient).
const INTRO_ORBS = [
  { top: '16%', left: '12%', size: 66, c1: '#ff4d6a', c2: '#ff9a3c', og: 'rgba(255,90,120,.55)', dur: '8s', dl: '0s' },
  { top: '26%', left: '80%', size: 52, c1: '#38b6ff', c2: '#9ff0ff', og: 'rgba(80,190,255,.5)', dur: '10s', dl: '.6s' },
  { top: '70%', left: '18%', size: 48, c1: '#72e878', c2: '#c3ffb0', og: 'rgba(110,235,140,.5)', dur: '9s', dl: '1.1s' },
  { top: '74%', left: '76%', size: 58, c1: '#b06bff', c2: '#22d3ee', og: 'rgba(150,120,255,.5)', dur: '11s', dl: '.3s' },
  { top: '50%', left: '88%', size: 38, c1: '#ffd23b', c2: '#ffb050', og: 'rgba(255,210,80,.45)', dur: '12s', dl: '1.6s' },
  { top: '46%', left: '5%', size: 42, c1: '#22d3ee', c2: '#7c5cff', og: 'rgba(60,210,255,.45)', dur: '10.5s', dl: '.9s' },
];

/**
 * Animated intro / launch sequence (spec Section 7).
 * Splash → constructed logo entrance (shards assemble, glow builds) with a short signature
 * audio sting → ambient idle → particle-disperse transition into the menu.
 * Skippable by tap after ~1s, but plays every cold launch (never skipped by default).
 */
export function IntroScreen() {
  const { navigate } = useApp();
  const [phase, setPhase] = useState<'build' | 'idle' | 'out'>('build');
  const canSkip = useRef(false);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    markIntroSeen();
    setPhase('out');
    // First run with no profile → create one; otherwise the menu. (The "learn the ropes?" prompt
    // still gates the tutorial when the player hits PLAY.)
    const dest = hasProfile() ? { name: 'menu' as const } : { name: 'profilesetup' as const, firstRun: true };
    setTimeout(() => navigate(dest), 520);
  };

  useEffect(() => {
    sfx.unlock();
    // Signature sting: a short ascending shard-chime.
    const sting = setTimeout(() => sfx.play('unlock'), 250);
    const t1 = setTimeout(() => (canSkip.current = true), 1000);
    const t2 = setTimeout(() => setPhase('idle'), 1500);
    const t3 = setTimeout(finish, 3600);
    return () => {
      clearTimeout(sting);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTap = () => {
    sfx.unlock();
    if (canSkip.current) finish();
  };

  return (
    <div className={`intro ${phase}`} onPointerDown={onTap}>
      <div className="intro-bg" />
      <div className="intro-orbs" aria-hidden>
        {INTRO_ORBS.map((o, i) => (
          <span
            key={i}
            className="intro-orb"
            style={{
              top: o.top,
              left: o.left,
              width: o.size,
              height: o.size,
              animationDelay: o.dl,
              ['--c1' as string]: o.c1,
              ['--c2' as string]: o.c2,
              ['--og' as string]: o.og,
              ['--dur' as string]: o.dur,
            }}
          />
        ))}
      </div>
      <div className="intro-shards" aria-hidden>
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className="shard" style={{ ['--i' as string]: i }}>
            <IconRiotShard size={16 + (i % 4) * 6} color={i % 2 ? '#22d3ee' : '#7c5cff'} />
          </span>
        ))}
      </div>
      <div className="intro-logo">
        <div className="intro-burst" aria-hidden />
        <WordArt text="RHYTHM" size={72} tilt={-5} colors={['#ffffff', '#b9a3ff', '#7c5cff']} />
        <WordArt text="RIOT" size={92} tilt={-5} colors={['#ffffff', '#8ef0ff', '#22d3ee']} />
      </div>
      <div className="intro-tag">tap to the beat · ride the mood</div>
      {phase !== 'out' && <div className="intro-skip">tap to start</div>}
    </div>
  );
}
