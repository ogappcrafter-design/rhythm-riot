import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/appContext';
import { markIntroSeen } from '../state/storage';
import { WordArt } from '../components/WordArt';
import { IconRiotShard } from '../components/icons';
import { sfx } from '../audio/sfx';

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
    setTimeout(() => navigate({ name: 'menu' }), 520);
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
      <div className="intro-shards" aria-hidden>
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className="shard" style={{ ['--i' as string]: i }}>
            <IconRiotShard size={16 + (i % 4) * 6} color={i % 2 ? '#22d3ee' : '#7c5cff'} />
          </span>
        ))}
      </div>
      <div className="intro-logo">
        <WordArt text="RHYTHM" size={72} tilt={-5} colors={['#ffffff', '#b9a3ff', '#7c5cff']} />
        <WordArt text="RIOT" size={92} tilt={-5} colors={['#ffffff', '#8ef0ff', '#22d3ee']} />
      </div>
      <div className="intro-tag subtle">tap to the beat · ride the mood</div>
      {phase !== 'out' && <div className="intro-skip faint">tap to skip</div>}
    </div>
  );
}
