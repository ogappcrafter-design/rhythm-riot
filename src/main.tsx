import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppProvider } from './state/appContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initStorage } from './state/storage';
import '@fontsource/bungee/latin-400.css';
import '@fontsource/russo-one/latin-400.css';
import '@fontsource/orbitron/latin-700.css';
import '@fontsource/orbitron/latin-900.css';
import './index.css';
import './styles/screens.css';
import './styles/premium.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found');

// Hydrate durable saved progress from native storage BEFORE first render, so scores,
// unlocks and settings are present immediately. initStorage falls back to localStorage /
// defaults if the native plugin isn't available, so the web build works unchanged.
// Art fonts are bundled (no network). Load them before the first paint so word art measures
// correctly and the canvas engine never draws a frame in a fallback system font. Capped wait.
const fontsReady = Promise.race([
  Promise.all(
    ['48px Bungee', '20px "Russo One"', '700 20px Orbitron', '900 20px Orbitron'].map((f) =>
      document.fonts?.load(f).catch(() => undefined),
    ),
  ),
  new Promise((r) => setTimeout(r, 1500)),
]);

Promise.all([initStorage(), fontsReady]).finally(() => {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <AppProvider initialRoute={{ name: 'branding' }}>
          <App />
        </AppProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
});
