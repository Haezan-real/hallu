export interface CursorPosition {
  x: number;
  y: number;
}

//src/electronApi.ts

export interface ElectronAPI {
  minimizeWindow: () => void;
  toggleMaximizeWindow: () => void;
  toggleFullscreen: () => void;
  closeWindow: () => void;
  beginWindowDrag: (position: CursorPosition) => void;
  moveWindowDrag: (position: CursorPosition) => void;
  endWindowDrag: () => void;
  loadUserSettings: () => Promise<Record<string, unknown> | null>;
  saveUserSettings: (data: Record<string, unknown>) => void;
  saveUserSettingsSync: (data: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
