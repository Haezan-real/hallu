//src/modals/shaders/shaderRegistry.ts

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

// Saves the choice and tells the viewer background to switch
export function setActiveShader(shaderName: string) {
  try { window.localStorage.setItem(ACTIVE_SHADER_KEY, shaderName); } catch {}
  window.dispatchEvent(new CustomEvent(SHADER_CHANGE_EVENT, { detail: { shaderName } }));
}

export function getShaderChangeName(event: Event): string | undefined {
  return (event as CustomEvent<{ shaderName?: string }>).detail?.shaderName;
}

/** Every folder in user/shaders that has an index.ts. */
export function listShaders(): string[] {
  const shaderModules = import.meta.glob('../../../../user/shaders/*/index.ts', { eager: false });
  const names = Object.keys(shaderModules)
    .map(path => path.match(/user\/shaders\/([^/]+)\/index\.ts/)?.[1])
    .filter((name): name is string => !!name);
  return names.length > 0 ? names : [DEFAULT_SHADER];
}
