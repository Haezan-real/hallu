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

export type ShaderChannel =
  | { kind: 'pass'; source: string; filter: 'linear' | 'nearest'; wrap: 'clamp' | 'repeat' }
  | { kind: 'image'; source: string; filter: 'linear' | 'nearest'; wrap: 'clamp' | 'repeat'; flipY: boolean };

export interface CompiledShaderPass {
  /** null for the last pass, which draws to the screen */
  name: string | null;
  kind: 'image' | 'buffer' | 'compute';
  file: string;
  wgsl: string;
  /** Boilerplate lines before the author's WGSL; null when lines don't map back (GLSL) */
  lineOffset: number | null;
  channels: (ShaderChannel | null)[];
  dispatch: [number, number, number] | null;
  workgroupSize: [number, number, number] | null;
}

export type CompiledShaderSurface = { ok: true; passes: CompiledShaderPass[]; storage: number; cached: boolean };

export type ShaderCompileResult =
  | CompiledShaderSurface
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
  readShaderAsset: (packId: string, file: string) => Promise<Uint8Array>;
  onShaderPacksChanged: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
