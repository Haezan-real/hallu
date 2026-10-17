//src/features/shaders/ShaderBackground.tsx
import { useEffect, useRef } from 'react';
import { showToast } from '../../shared/ui/Toast';
import type { ShaderCompileError } from '../../shared/platform/electronApi';
import { SHADER_CHANGE_EVENT, getActiveShader } from './shaderRegistry';
import { ShaderBackgroundRenderer } from './shaderBackgroundRenderer';
import { setShaderPaintsMasterTitleBar } from './shaderOptIns';

const SURFACE = 'background';
/** On <html> while a shader is drawing, so panels only turn see-through when there's something behind them */
const ACTIVE_CLASS = 'shader-background-active';
/** On <html> while the drawing pack paints the panels' title bars itself, so they turn transparent */
const PAINTS_HEADERS_CLASS = 'shader-paints-panel-headers';
/** On <html> while the drawing pack paints Hallu's own title bar, so it turns transparent */
const PAINTS_MASTER_TITLE_BAR_CLASS = 'shader-paints-master-title-bar';
const setActive = (active: boolean, paintsPanelHeaders = false, paintsMasterTitleBar = false) => {
  document.documentElement.classList.toggle(ACTIVE_CLASS, active);
  document.documentElement.classList.toggle(PAINTS_HEADERS_CLASS, active && paintsPanelHeaders);
  document.documentElement.classList.toggle(PAINTS_MASTER_TITLE_BAR_CLASS, active && paintsMasterTitleBar);
  setShaderPaintsMasterTitleBar(active && paintsMasterTitleBar);
};

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);

function reportShaderErrors(file: string, errors: ShaderCompileError[]) {
  for (const error of errors) {
    console.error(`Shader error in ${file}${error.line ? ` line ${error.line}` : ''}: ${error.message}`);
  }
  const first = errors[0];
  if (first) showToast(escapeHtml(`Shader error in ${file}${first.line ? ` line ${first.line}` : ''}: ${first.message}`));
}

/**
 * Full-window WebGPU canvas behind the whole UI, drawing the active style's shader pack
 * background surface. It shows through wherever the UI above it is transparent, and stays
 * empty for colors-only styles.
 */
export default function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const api = window.electronAPI;
    if (!canvas || !api) return;

    let disposed = false;
    let renderer: ShaderBackgroundRenderer | null = null;
    let latestRequest = 0;

    // A broken shader leaves the last working one running, so live edits never blank the screen
    const load = async (packId: string | null) => {
      const request = ++latestRequest;
      if (packId === null) {
        renderer?.clearProgram();
        setActive(false);
        return;
      }
      const result = await api.compileShaderSurface(packId, SURFACE);
      if (disposed || request !== latestRequest || !renderer) return;
      if (!result.ok) {
        reportShaderErrors(result.file, result.errors);
        return;
      }
      const failure = await renderer.setProgram(result, file => api.readShaderAsset(packId, file));
      if (disposed) return;
      if (failure) reportShaderErrors(failure.file, failure.errors);
      else setActive(true, result.paintsPanelHeaders, result.paintsMasterTitleBar);
    };

    const start = async () => {
      const created = await ShaderBackgroundRenderer.create(canvas);
      if (disposed) {
        created?.destroy();
        return;
      }
      if (!created) {
        console.warn('WebGPU is unavailable; the shader background is disabled');
        return;
      }
      renderer = created;
      // Driver resets lose the device; rebuild everything from the (cached) WGSL
      void created.lost.then(info => {
        if (disposed || info.reason === 'destroyed') return;
        console.warn(`WebGPU device lost (${info.message}); restarting the shader background`);
        renderer = null;
        void start();
      });
      await load(getActiveShader());
    };
    void start();

    const onShaderChange = () => void load(getActiveShader());
    window.addEventListener(SHADER_CHANGE_EVENT, onShaderChange);

    return () => {
      disposed = true;
      window.removeEventListener(SHADER_CHANGE_EVENT, onShaderChange);
      renderer?.destroy();
      setActive(false);
    };
  }, []);

  return <canvas ref={canvasRef} className="shader-background" aria-hidden="true" />;
}
