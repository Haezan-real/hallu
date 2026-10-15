//src/features/shaders/shaderRegistry.ts
// Which shader pack the background draws. The active style decides it; null turns the background off.

export const SHADER_CHANGE_EVENT = 'hallu-shader-change';

let activeShader: string | null = null;

export function getActiveShader(): string | null {
  return activeShader;
}

/** Switches the background to a pack. reload recompiles it even when it's already running, after its files change. */
export function setActiveShader(packId: string | null, { reload = false } = {}) {
  if (packId === activeShader && !reload) return;
  activeShader = packId;
  window.dispatchEvent(new Event(SHADER_CHANGE_EVENT));
}
