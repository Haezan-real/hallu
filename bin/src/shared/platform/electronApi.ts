//src/shared/platform/electronApi.ts

export interface ShaderCompileError {
  line: number | null;
  message: string;
}

export type ShaderChannel =
  | { kind: 'pass'; source: string; filter: 'linear' | 'nearest'; wrap: 'clamp' | 'repeat' }
  | { kind: 'image'; source: string; filter: 'linear' | 'nearest'; wrap: 'clamp' | 'repeat'; flipY: boolean };

/** A geometry pass's vertex stage and draw settings */
export interface ShaderGeometry {
  vertexFile: string;
  vertexWgsl: string;
  vertexCount: number;
  instanceCount: number;
  blend: 'replace' | 'add' | 'alpha';
  depth: boolean;
}

export interface CompiledShaderPass {
  /** null for the last pass, which draws to the screen */
  name: string | null;
  kind: 'image' | 'buffer' | 'compute' | 'geometry';
  file: string;
  wgsl: string;
  /** Boilerplate lines before the author's WGSL; null when lines don't map back (GLSL) */
  lineOffset: number | null;
  channels: (ShaderChannel | null)[];
  dispatch: [number, number, number] | null;
  /** Fraction of the screen size a buffer pass renders at; 1 for every other pass */
  scale: number;
  workgroupSize: [number, number, number] | null;
  geometry: ShaderGeometry | null;
}

export type CompiledShaderSurface = { ok: true; passes: CompiledShaderPass[]; storage: number; cached: boolean };

export type ShaderCompileResult =
  | CompiledShaderSurface
  | { ok: false; file: string; stage: string; errors: ShaderCompileError[] };

/** A style's .frag or image icon; version changes whenever the file does */
export interface StyleIconFile {
  kind: 'shader' | 'image';
  file: string;
  version: number;
}

export type StyleLibraryItem =
  | { id: string; label: string; type: 'folder'; parent: string | null; children: string[] }
  | {
    id: string;
    label: string;
    type: 'style';
    parent: string | null;
    colors: Partial<Record<string, string>>;
    icon: StyleIconFile | null;
    /** The style's shader pack id, or null for a colors-only style */
    shader: string | null;
  };

export type StyleIconShaderResult =
  | { ok: true; wgsl: string }
  | { ok: false; errors: ShaderCompileError[] };

/** Everything under user/styles; ids are paths like "default/forest" (a theme file) or "cyberpunk" (a pack) */
export interface StyleLibrary {
  topLevel: string[];
  items: Record<string, StyleLibraryItem>;
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
  compileShaderSurface: (packId: string, surface: string) => Promise<ShaderCompileResult>;
  readShaderAsset: (packId: string, file: string) => Promise<Uint8Array>;
  loadStyles: () => Promise<StyleLibrary>;
  readStyleIconImage: (file: string) => Promise<Uint8Array>;
  compileStyleIconShader: (file: string) => Promise<StyleIconShaderResult>;
  onStylesChanged: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
