import { useEffect } from 'react';
import { useApp } from './state/appContext';
import { preview } from './audio/preview';
import { IntroScreen } from './screens/IntroScreen';
import { MainMenu } from './screens/MainMenu';
import { SongSelect } from './screens/SongSelect';
import { ReadyScreen } from './screens/ReadyScreen';
import { GameplayScreen } from './screens/GameplayScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { HelpScreen } from './screens/HelpScreen';
import { TutorialScreen } from './screens/TutorialScreen';
import { CalibrationScreen } from './screens/CalibrationScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { SynthwaveBackground } from './components/SynthwaveBackground';
import { PlayPromptScreen } from './screens/PlayPromptScreen';
import { ProfileSetupScreen } from './screens/ProfileSetupScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';

/** Only gameplay paints its own full-screen background; everything else shares ONE persistent
 *  aurora so navigating between screens never flashes or restarts the background. */

// Screens that get the low-volume looping song previews behind them.
const PREVIEW_ROUTES = new Set(['intro', 'menu', 'songselect', 'playprompt']);

export function App() {
  const { route, settings } = useApp();

  // Ambient song previews on the entry/menu/song-select screens; silence during play & elsewhere.
  useEffect(() => {
    if (PREVIEW_ROUTES.has(route.name)) {
      void preview.start(Math.min(0.3, settings.musicVolume * 0.35));
    } else {
      preview.stop();
    }
  }, [route.name, settings.musicVolume]);

  const body = (() => {
    switch (route.name) {
      case 'intro':
        return <IntroScreen />;
      case 'menu':
        return <MainMenu />;
      case 'songselect':
        return <SongSelect />;
      case 'ready':
        return <ReadyScreen trackId={route.trackId} difficulty={route.difficulty} challenge={route.challenge} />;
      case 'game':
        // key forces a fresh engine mount per run (prevents stale canvas/engine reuse).
        return (
          <GameplayScreen
            key={`${route.trackId}:${route.difficulty}`}
            trackId={route.trackId}
            difficulty={route.difficulty}
            challenge={route.challenge}
          />
        );
      case 'results':
        return (
          <ResultsScreen
            result={route.result}
            isNewRecord={route.isNewRecord}
            expertJustUnlocked={route.expertJustUnlocked}
            challenge={route.challenge}
          />
        );
      case 'leaderboard':
        return <LeaderboardScreen />;
      case 'settings':
        return <SettingsScreen />;
      case 'help':
        return <HelpScreen />;
      case 'tutorial':
        return <TutorialScreen />;
      case 'playprompt':
        return <PlayPromptScreen />;
      case 'profilesetup':
        return <ProfileSetupScreen firstRun={route.firstRun} />;
      case 'profile':
        return <ProfileScreen />;
      case 'calibration':
        return <CalibrationScreen />;
    }
  })();

  return (
    <div className="app-frame">
      {route.name !== 'game' && <SynthwaveBackground />}
      {body}
    </div>
  );
}
