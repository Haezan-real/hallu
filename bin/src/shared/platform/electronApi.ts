//src/shared/platform/electronApi.ts

export interface ShaderPackInfo {
  id: string;
  name: string;
  language: 'glsl' | 'wgsl';
}

export interface ShaderCompileError {
  line: number | null;
  message: string;
}

export type ShaderCompileResult =
  | { ok: true; file: string; wgsl: string; lineOffset: number; cached: boolean }
  | { ok: false; file: string; stage: string; errors: ShaderCompileError[] };

export interface ElectronAPI {
  minimizeWindow: () => void;
  toggleMaximizeWindow: () => void;
  toggleFullscreen: () => void;
  closeWindow: () => void;
  loadUserSettings: () => Promise<Record<string, unknown> | null>;
  saveUserSettings: (data: Record<string, unknown>) => void;
  saveUserSettingsSync: (data: Record<string, unknown>) => void;
  listShaderPacks: () => Promise<ShaderPackInfo[]>;
  compileShaderSurface: (packId: string, surface: string) => Promise<ShaderCompileResult>;
  onShaderPacksChanged: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
