import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import './index.css';
import { migrateLegacyStorage, migrateRenamedKeys } from './modals/settings/storageMigration';
import { initUserSettingsSync } from './modals/settings/userSettingsSync';
import { readSetting } from './modals/settings/settingsStore';
import { applyTransitionDuration } from './app/useAppearance';
import { loadStyleLibrary } from './modals/styles/styleLibrary';
import { initActiveStyle } from './modals/styles/activeStyle';

//src/main.tsx

migrateLegacyStorage();

async function start() {
  await Promise.all([initUserSettingsSync(), loadStyleLibrary()]);
  migrateRenamedKeys();
  initActiveStyle();

  // Initialize the theme transition before the app renders
  applyTransitionDuration(readSetting('colorTransitionDuration'));

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

start();
