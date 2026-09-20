import { useApp } from '../state/appContext';
import { ScreenHeader } from '../components/ui';
import { IconRiotShard } from '../components/icons';
import { WordArt } from '../components/WordArt';
import { sfx } from '../audio/sfx';

// Developer support inbox for player feedback. Change to your support address.
const SUPPORT_EMAIL = 'outcastingaway@gmail.com';

function HowStep({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="card how-step">
      <div className="how-num">{n}</div>
      <div>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <div className="subtle" style={{ marginTop: 2 }}>{body}</div>
      </div>
    </div>
  );
}

export function HelpScreen() {
  const { goBack } = useApp();

  return (
    <div className="screen">
      <ScreenHeader title="HOW TO PLAY" onBack={() => { sfx.play('uiBack'); goBack(); }} />
      <div className="stack" style={{ paddingBottom: 20 }}>
        <div className="card center" style={{ padding: 18 }}>
          <IconRiotShard size={40} color="#7c5cff" />
          <div style={{ height: 34, width: 220, marginTop: 8 }}>
            <WordArt text="RIDE THE MOOD" size={22} />
          </div>
        </div>

        <HowStep n={1} title="Tap in time" body="Glowing stars fall down the lanes. Tap the matching lane pad the moment a star reaches the bright hit ring." />
        <HowStep n={2} title="Chase Perfects" body="The tighter your timing, the better the grade — Perfect, Great, Good. Missing never ends the run; every song plays to the finish." />
        <HowStep n={3} title="Hold the long ones" body="Some stars trail a glowing tail — press when the star lands and keep holding until the tail runs out for bonus points. Let go early and your combo breaks." />
        <HowStep n={4} title="Build the Mood" body="Streaks push a hidden Mood Meter up — the whole screen gets warmer, brighter and wilder. Break your combo and it cools back down." />
        <HowStep n={5} title="Earn the Vibe Score" body="Riding the song's natural build-ups cleanly earns a secret Vibe Score on top of your accuracy score." />
        <HowStep n={6} title="Unlock Expert" body="Hit 90% Perfect on Hard for any track to permanently unlock its hand-charted 5-lane Expert." />

        <a
          className="btn btn-primary btn-block"
          style={{ textAlign: 'center', textDecoration: 'none' }}
          href={`mailto:${SUPPORT_EMAIL}?subject=Rhythm%20Riot%20Feedback`}
          onClick={() => sfx.play('uiTap')}
        >
          Send Feedback
        </a>
        <div className="faint center">Tip: if the beat feels off, run Calibrate Latency from the menu.</div>
      </div>
    </div>
  );
}
