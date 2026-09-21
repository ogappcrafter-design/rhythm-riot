import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppProvider } from './state/appContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initStorage } from './state/storage';
import './index.css';
import './styles/screens.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found');

// Hydrate durable saved progress from native storage BEFORE first render, so scores,
// unlocks and settings are present immediately. initStorage falls back to localStorage /
// defaults if the native plugin isn't available, so the web build works unchanged.
initStorage().finally(() => {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <AppProvider initialRoute={{ name: 'intro' }}>
          <App />
        </AppProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
});
