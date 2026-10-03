import { useApp } from '../state/appContext';
import { markPlayPromptSeen } from '../state/storage';
import { WordArt } from '../components/WordArt';
import { IconHelp } from '../components/icons';
import { sfx } from '../audio/sfx';

/**
 * First-play gate: a premium glowing pop-up shown the very first time the player hits PLAY, before
 * the song list. Nudges them to run the tutorial first ("learn the ropes") so they don't blow a
 * high score. "Alright" → tutorial; "No thanks" → straight to song select. Shown only once.
 */
export function PlayPromptScreen() {
  const { navigate } = useApp();

  const choose = (toTutorial: boolean) => {
    sfx.play(toTutorial ? 'uiTap' : 'uiBack');
    markPlayPromptSeen();
    navigate(toTutorial ? { name: 'tutorial' } : { name: 'songselect' });
  };

  return (
    <div className="screen center" style={{ justifyContent: 'center' }}>
      <div className="play-prompt" role="dialog" aria-modal="true">
        <div className="play-prompt-glow" aria-hidden />
        <div className="play-prompt-badge" aria-hidden>
          <IconHelp size={34} color="#fff" />
        </div>
        <div style={{ height: 46, width: '100%', marginTop: 6 }}>
          <WordArt text="LEARN THE ROPES?" size={30} colors={['#ffffff', '#8ef0ff', '#22d3ee']} tilt={-3} fitHeight />
        </div>
        <p className="play-prompt-copy">
          We really recommend running the quick tutorial first — even if you&apos;re a rhythm-game pro.
          It only takes a minute, and I&apos;d hate for you to fumble the controls and tank that first
          high score. 😏
        </p>
        <div className="play-prompt-actions">
          <button className="btn btn-ghost btn-block" onClick={() => choose(false)}>
            No thanks
          </button>
          <button className="btn btn-primary btn-block" onClick={() => choose(true)}>
            Alright, show me
          </button>
        </div>
      </div>
    </div>
  );
}
