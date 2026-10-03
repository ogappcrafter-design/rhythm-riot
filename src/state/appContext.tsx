import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Difficulty } from '../engine/chartTypes';
import type { RunResult } from '../engine/gameEngine';
import { getSettings, saveSettings, type Settings } from './storage';
import { sfx } from '../audio/sfx';

export type Route =
  | { name: 'intro' }
  | { name: 'menu' }
  | { name: 'songselect' }
  | { name: 'ready'; trackId: string; difficulty: Difficulty }
  | { name: 'game'; trackId: string; difficulty: Difficulty }
  | { name: 'results'; result: RunResult; isNewRecord: boolean; expertJustUnlocked: boolean }
  | { name: 'settings' }
  | { name: 'help' }
  | { name: 'tutorial' }
  | { name: 'playprompt' }
  | { name: 'profile' }
  | { name: 'calibration' };

interface AppContextValue {
  route: Route;
  navigate: (r: Route) => void;
  goBack: () => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children, initialRoute }: { children: ReactNode; initialRoute: Route }) {
  const [route, setRoute] = useState<Route>(initialRoute);
  const [settings, setSettings] = useState<Settings>(() => getSettings());
  const history = useRef<Route[]>([]);

  // Keep the SFX engine's live volume in sync with the setting.
  sfx.setVolume(settings.sfxVolume);

  const navigate = useCallback((r: Route) => {
    setRoute((prev) => {
      // Don't stack transient/full-screen states we never want "back" to return to.
      if (prev.name !== 'game' && prev.name !== 'results' && prev.name !== 'intro') {
        history.current.push(prev);
        if (history.current.length > 20) history.current.shift();
      }
      return r;
    });
  }, []);

  const goBack = useCallback(() => {
    const prev = history.current.pop();
    setRoute(prev ?? { name: 'menu' });
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    const next = saveSettings(patch);
    setSettings({ ...next });
    if (patch.sfxVolume !== undefined) sfx.setVolume(next.sfxVolume);
  }, []);

  const value = useMemo(
    () => ({ route, navigate, goBack, settings, updateSettings }),
    [route, navigate, goBack, settings, updateSettings],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
