//src/modals/styles/styleShader.ts
// Points the shader background at a style's pack, and turns it off for colors-only styles
import { setActiveShader } from '../../features/shaders/shaderRegistry';
import { findStyle } from './styleLibrary';

export function applyStyleShader(styleId: string, { reload = false } = {}) {
  setActiveShader(findStyle(styleId)?.shader ?? null, { reload });
}
