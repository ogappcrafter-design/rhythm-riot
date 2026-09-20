import { useApp } from './state/appContext';
import { IntroScreen } from './screens/IntroScreen';
import { MainMenu } from './screens/MainMenu';
import { SongSelect } from './screens/SongSelect';
import { ReadyScreen } from './screens/ReadyScreen';
import { GameplayScreen } from './screens/GameplayScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { HelpScreen } from './screens/HelpScreen';
import { CalibrationScreen } from './screens/CalibrationScreen';

/** Screens that use the shared animated menu background (gameplay & intro paint their own). */
const MENU_BG = new Set(['menu', 'songselect', 'ready', 'results', 'settings', 'help', 'calibration']);

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
      case 'calibration':
        return <CalibrationScreen />;
    }
  })();

  return (
    <div className="app-frame">
      {MENU_BG.has(route.name) && <div className="bg-scene" />}
      {body}
    </div>
  );
}
