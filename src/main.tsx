import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppProvider } from './state/appContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { loadSave } from './state/storage';
import './index.css';
import './styles/screens.css';

// Warm the save cache (also applies persisted settings on first read).
loadSave();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found');

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProvider initialRoute={{ name: 'intro' }}>
        <App />
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>,
);
