import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import './index.css';
import { migrateLegacyStorage } from './modals/settings/storageMigration';
import { initUserSettingsSync } from './modals/settings/userSettingsSync';
import { readSetting } from './modals/settings/settingsStore';
import { applyTransitionDuration } from './app/useAppearance';

//src/main.tsx

migrateLegacyStorage();

async function start() {
  await initUserSettingsSync();

  // Initialize the theme transition before the app renders
  applyTransitionDuration(readSetting('colorTransitionDuration'));

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

start();
