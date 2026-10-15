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

/** A same-name .frag or image next to a theme file; version changes whenever the file does */
export interface ThemeIconFile {
  kind: 'shader' | 'image';
  file: string;
  version: number;
}

export type ThemeLibraryItem =
  | { id: string; label: string; type: 'folder'; parent: string | null; children: string[] }
  | { id: string; label: string; type: 'theme'; parent: string | null; colors: Partial<Record<string, string>>; icon: ThemeIconFile | null };

export type ThemeIconShaderResult =
  | { ok: true; wgsl: string }
  | { ok: false; errors: ShaderCompileError[] };

/** Everything under user/themes; ids are paths without ".json", like "default/cyberpunk" */
export interface ThemeLibrary {
  topLevel: string[];
  items: Record<string, ThemeLibraryItem>;
  problems: { file: string; message: string }[];
}

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
  loadThemes: () => Promise<ThemeLibrary>;
  readThemeIconImage: (file: string) => Promise<Uint8Array>;
  compileThemeIconShader: (file: string) => Promise<ThemeIconShaderResult>;
  onThemesChanged: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
