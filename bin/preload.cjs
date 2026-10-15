//preload.cjs
const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

console.log('🔧 Preload script loaded');

// 1. Read config.json safely
const configPath = path.join(__dirname, 'config.json');
let borderRadius = '0px'; // Default fallback
try {
  const configData = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(configData);
  
  // Explicitly check for undefined so that '0' is treated as a valid number
  const radiusVal = config.electron_window_border_radius !== undefined 
    ? config.electron_window_border_radius 
    : 0;
    
  borderRadius = `${radiusVal}px`;
} catch (err) {
  console.error('🔧 Failed to read config.json in preload:', err);
}

// 2. Inject the CSS variable safely AFTER the DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    :root {
      --electron-window-border-radius: ${borderRadius};
    }
  `;
  
  // Double-check that document.head exists before appending
  if (document.head) {
    document.head.appendChild(style);
  }
});

// 3. Expose an explicit, allowlisted IPC API
contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('window-maximize'),
  toggleFullscreen: () => ipcRenderer.send('window-fullscreen'),
  closeWindow: () => ipcRenderer.send('window-close'),
  loadUserSettings: () => ipcRenderer.invoke('load-user-settings'),
  saveUserSettings: (data) => ipcRenderer.send('save-user-settings', data),
  saveUserSettingsSync: (data) => ipcRenderer.send('save-user-settings-sync', data),
  listShaderPacks: () => ipcRenderer.invoke('shader-packs-list'),
  compileShaderSurface: (packId, surface) => ipcRenderer.invoke('shader-packs-compile', packId, surface),
  readShaderAsset: (packId, file) => ipcRenderer.invoke('shader-packs-asset', packId, file),
  onShaderPacksChanged: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('shader-packs-changed', listener);
    return () => ipcRenderer.removeListener('shader-packs-changed', listener);
  },
  loadThemes: () => ipcRenderer.invoke('themes-load'),
  readThemeIconImage: (file) => ipcRenderer.invoke('themes-icon-image', file),
  compileThemeIconShader: (file) => ipcRenderer.invoke('themes-icon-shader', file),
  onThemesChanged: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('themes-changed', listener);
    return () => ipcRenderer.removeListener('themes-changed', listener);
  },
});