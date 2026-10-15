//src/features/shaders/ShaderBackground.tsx
import { useEffect, useRef } from 'react';
import { showToast } from '../../shared/ui/Toast';
import type { ShaderCompileError } from '../../shared/platform/electronApi';
import { SHADER_CHANGE_EVENT, getActiveShader, getShaderChangeName } from './shaderRegistry';
import { ShaderBackgroundRenderer } from './shaderBackgroundRenderer';

const SURFACE = 'background';

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);

function reportShaderErrors(file: string, errors: ShaderCompileError[]) {
  for (const error of errors) {
    console.error(`Shader error in ${file}${error.line ? ` line ${error.line}` : ''}: ${error.message}`);
  }
  const first = errors[0];
  if (first) showToast(escapeHtml(`Shader error in ${file}${first.line ? ` line ${first.line}` : ''}: ${first.message}`));
}

/**
 * Full-window WebGPU canvas behind the whole UI, drawing the active shader pack's
 * background surface. It shows through wherever the UI above it is transparent.
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
    const load = async (packId: string) => {
      const request = ++latestRequest;
      const result = await api.compileShaderSurface(packId, SURFACE);
      if (disposed || request !== latestRequest || !renderer) return;
      if (!result.ok) {
        reportShaderErrors(result.file, result.errors);
        return;
      }
      const failure = await renderer.setProgram(result, file => api.readShaderAsset(packId, file));
      if (failure && !disposed) reportShaderErrors(failure.file, failure.errors);
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

    const onShaderChange = (event: Event) => {
      const packId = getShaderChangeName(event);
      if (packId) void load(packId);
    };
    window.addEventListener(SHADER_CHANGE_EVENT, onShaderChange);
    const stopWatching = api.onShaderPacksChanged(() => void load(getActiveShader()));

    return () => {
      disposed = true;
      window.removeEventListener(SHADER_CHANGE_EVENT, onShaderChange);
      stopWatching();
      renderer?.destroy();
    };
  }, []);

  return <canvas ref={canvasRef} className="shader-background" aria-hidden="true" />;
}
