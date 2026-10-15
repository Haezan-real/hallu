//src/features/shaders/shaderRegistry.ts
import type { ShaderPackInfo } from '../../shared/platform/electronApi';

export const SHADER_CHANGE_EVENT = 'hallu-shader-change';
export const DEFAULT_SHADER = 'haezans_shader';
const ACTIVE_SHADER_KEY = 'hallu.shaders.active';
// Shaders that used to ship with the app and no longer exist
const REMOVED_SHADERS = ['default_shader', 'glitch', 'plasma'];

export function getActiveShader(): string {
  try {
    const stored = window.localStorage.getItem(ACTIVE_SHADER_KEY);
    return !stored || REMOVED_SHADERS.includes(stored) ? DEFAULT_SHADER : stored;
  } catch {
    return DEFAULT_SHADER;
  }
}

// Saves the choice and tells the shader background to switch
export function setActiveShader(shaderName: string) {
  try {
    window.localStorage.setItem(ACTIVE_SHADER_KEY, shaderName);
  } catch {
    // Storage can be unavailable; the switch still applies for this session
  }
  window.dispatchEvent(new CustomEvent(SHADER_CHANGE_EVENT, { detail: { shaderName } }));
}

export function getShaderChangeName(event: Event): string | undefined {
  return (event as CustomEvent<{ shaderName?: string }>).detail?.shaderName;
}

/** Every folder in user/shaders with a valid manifest.json. */
export async function listShaderPacks(): Promise<ShaderPackInfo[]> {
  return (await window.electronAPI?.listShaderPacks()) ?? [];
}
