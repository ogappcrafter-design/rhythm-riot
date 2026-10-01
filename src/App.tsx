import { useApp } from './state/appContext';
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
import { AuroraBackground } from './components/AuroraBackground';

/** Only gameplay paints its own full-screen background; everything else shares ONE persistent
 *  aurora so navigating between screens never flashes or restarts the background. */

export function App() {
  const { route } = useApp();

  const body = (() => {
    switch (route.name) {
      case 'intro':
        return <IntroScreen />;
      case 'menu':
        return <MainMenu />;
      case 'songselect':
        return <SongSelect />;
      case 'ready':
        return <ReadyScreen trackId={route.trackId} difficulty={route.difficulty} />;
      case 'game':
        // key forces a fresh engine mount per run (prevents stale canvas/engine reuse).
        return (
          <GameplayScreen
            key={`${route.trackId}:${route.difficulty}`}
            trackId={route.trackId}
            difficulty={route.difficulty}
          />
        );
      case 'results':
        return (
          <ResultsScreen
            result={route.result}
            isNewRecord={route.isNewRecord}
            expertJustUnlocked={route.expertJustUnlocked}
          />
        );
      case 'settings':
        return <SettingsScreen />;
      case 'help':
        return <HelpScreen />;
      case 'tutorial':
        return <TutorialScreen />;
      case 'profile':
        return <ProfileScreen />;
      case 'calibration':
        return <CalibrationScreen />;
    }
  })();

  return (
    <div className="app-frame">
      {route.name !== 'game' && <AuroraBackground />}
      {body}
    </div>
  );
}
