import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/appContext';

const LOGO_SRC = `${import.meta.env.BASE_URL}floatskyward.webp`;

/**
 * Studio branding splash — the very first thing shown on a cold launch, before the
 * Rhythm Riot intro. A hand-drawn "FloatSkyward" card drifts up onto warm paper
 * (balloon floating skyward, matching the brand), holds, then releases upward into the
 * intro. Fully self-contained paper backdrop (covers the shared synthwave aurora).
 *
 * Auto-advances (~2.9s); tappable to skip after a short beat so it never feels like a wall.
 */
export function BrandingScreen() {
  const { navigate } = useApp();
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');
  const canSkip = useRef(false);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    setPhase('out');
    // Let the release-upward animation play, then hand off to the intro.
    setTimeout(() => navigate({ name: 'intro' }), 620);
  };

  useEffect(() => {
    const t1 = setTimeout(() => (canSkip.current = true), 700);
    const t2 = setTimeout(() => setPhase('hold'), 1050);
    const t3 = setTimeout(finish, 2900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTap = () => {
    if (canSkip.current) finish();
  };

  return (
    <div className={`branding ${phase}`} onPointerDown={onTap} role="img" aria-label="FloatSkyward">
      <div className="branding-paper" aria-hidden />
      <div className="branding-stage">
        <img className="branding-logo" src={LOGO_SRC} alt="" draggable={false} />
        <div className="branding-sheen" aria-hidden />
      </div>
      {phase !== 'out' && <div className="branding-skip">tap to skip</div>}
    </div>
  );
}
