import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { DEFAULT_SETTINGS } from './core/settings/settingsDefaults';
import { migrateLegacyStorage } from './core/settings/storageMigration';
import { initUserSettingsSync } from './core/settings/userSettingsSync';

//src/main.tsx

migrateLegacyStorage();

async function start() {
  await initUserSettingsSync();

  // Initialize theme transition settings from localStorage before the app renders
  try {
    const saved = window.localStorage.getItem('hallu.settings.colorTransitionDuration');
    if (saved !== null) {
      const duration = Number(saved);
      document.documentElement.style.setProperty('--theme-transition-duration', `${duration}ms`);
    } else {
      document.documentElement.style.setProperty('--theme-transition-duration', `${DEFAULT_SETTINGS.colorTransitionDuration}ms`);
    }
    document.documentElement.style.setProperty('--theme-transition-timing', 'cubic-bezier(0.4, 0, 0.2, 1)');
  } catch {}

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

start();
