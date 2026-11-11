import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/appContext';
import { markIntroSeen, hasProfile } from '../state/storage';
import { TitleLogo } from '../components/TitleLogo';
import { sfx } from '../audio/sfx';

// Drifting glass bubbles (same look as the in-game notes), at three depths.
const BUBBLES = [
  { left: '8%', size: 58, c: '255,64,92', dur: 13, dl: 0, depth: 'near' },
  { left: '78%', size: 74, c: '56,182,255', dur: 15, dl: 2.5, depth: 'near' },
  { left: '30%', size: 34, c: '255,214,64', dur: 18, dl: 5, depth: 'mid' },
  { left: '62%', size: 40, c: '70,232,110', dur: 17, dl: 1.2, depth: 'mid' },
  { left: '88%', size: 26, c: '176,107,255', dur: 21, dl: 7, depth: 'far' },
  { left: '18%', size: 22, c: '56,182,255', dur: 23, dl: 9, depth: 'far' },
  { left: '48%', size: 30, c: '255,108,220', dur: 20, dl: 3.8, depth: 'far' },
  { left: '70%', size: 48, c: '255,214,64', dur: 16, dl: 10, depth: 'mid' },
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
      <div className="intro-rays" aria-hidden />
      <div className="intro-bubbles" aria-hidden>
        {BUBBLES.map((b, i) => (
          <span
            key={i}
            className={`intro-bubble ${b.depth}`}
            style={{
              left: b.left,
              width: b.size,
              height: b.size,
              animationDuration: `${b.dur}s`,
              animationDelay: `-${b.dl}s`,
              ['--c' as string]: b.c,
            }}
          />
        ))}
      </div>
      <div className="intro-logo">
        <TitleLogo animated />
      </div>
      <div className="intro-tag">TAP TO THE BEAT <i>✦</i> RIDE THE MOOD</div>
      {phase !== 'out' && <div className="intro-skip">TAP TO START</div>}
    </div>
  );
}
