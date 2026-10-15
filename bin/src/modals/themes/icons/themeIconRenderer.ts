//src/modals/themes/icons/themeIconRenderer.ts
import type { ShaderCompileError } from '../../../shared/platform/electronApi';
import {
  CHANNEL_COUNT,
  THEME_OFFSET,
  UNIFORM_FLOATS,
  VERTEX_WGSL,
  channelSamplerBinding,
  channelTextureBinding,
} from '../../../features/shaders/shaderBackgroundRenderer';

const FRAME_RATE_SMOOTHING = 0.9;

export interface ShaderIconHandle {
  /** Icons only animate while on screen */
  setVisible(visible: boolean): void;
  setThemeColors(colors: Float32Array): void;
  /** Draws one frame at a fixed iTime in seconds */
  renderAt(seconds: number): void;
  destroy(): void;
}

interface ShaderIcon {
  canvas: HTMLCanvasElement;
  context: GPUCanvasContext;
  pipeline: GPURenderPipeline;
  uniforms: GPUBuffer;
  bindGroup: GPUBindGroup;
  themeColors: Float32Array;
  visible: boolean;
  startTime: number;
  lastTime: number;
  frame: number;
  frameRate: number;
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Draws the shader icons in the Themes modal: single-pass mainImage shaders with the same
 * inputs as a shader pack's screen pass, where iTheme holds that icon's own theme colors.
 * All icons share one GPU device and one animation loop.
 */
class ThemeIconRenderer {
  private icons = new Set<ShaderIcon>();
  private canvasOwners = new WeakMap<HTMLCanvasElement, ShaderIcon>();
  private rafId = 0;
  private uniformData = new Float32Array(UNIFORM_FLOATS);
  private uniformInts = new Int32Array(this.uniformData.buffer);
  private format = navigator.gpu.getPreferredCanvasFormat();
  private bindGroupLayout: GPUBindGroupLayout;
  private pipelineLayout: GPUPipelineLayout;
  private vertexModule: GPUShaderModule;
  private emptyView: GPUTextureView;
  private sampler: GPUSampler;

  constructor(private device: GPUDevice) {
    const entries: GPUBindGroupLayoutEntry[] = [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }];
    for (let slot = 0; slot < CHANNEL_COUNT; slot++) {
      entries.push(
        { binding: channelTextureBinding(slot), visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: channelSamplerBinding(slot), visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      );
    }
    this.bindGroupLayout = device.createBindGroupLayout({ entries });
    this.pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout] });
    this.vertexModule = device.createShaderModule({ code: VERTEX_WGSL });
    // Icons have no iChannel inputs; shaders that sample one read transparent black
    this.emptyView = device.createTexture({ size: [1, 1], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING }).createView();
    this.sampler = device.createSampler();
  }

  /**
   * Returns a handle, or the errors that stopped the shader from building. An aborted request
   * returns null without touching the canvas, which a newer request may already be using.
   */
  async createIcon(canvas: HTMLCanvasElement, wgsl: string, themeColors: Float32Array, signal?: AbortSignal): Promise<ShaderIconHandle | ShaderCompileError[] | null> {
    const module = this.device.createShaderModule({ code: wgsl });
    const info = await module.getCompilationInfo();
    const errors = info.messages.filter(message => message.type === 'error').map(message => ({ line: null, message: message.message }));
    if (errors.length > 0) return errors;

    let pipeline: GPURenderPipeline;
    try {
      pipeline = await this.device.createRenderPipelineAsync({
        layout: this.pipelineLayout,
        vertex: { module: this.vertexModule, entryPoint: 'main' },
        fragment: { module, entryPoint: 'main', targets: [{ format: this.format }] },
        primitive: { topology: 'triangle-list' },
      });
    } catch (err) {
      return [{ line: null, message: errorMessage(err) }];
    }
    if (signal?.aborted) return null;

    const context = canvas.getContext('webgpu');
    if (!context) return [{ line: null, message: 'this canvas cannot use WebGPU' }];
    context.configure({ device: this.device, format: this.format, alphaMode: 'premultiplied' });

    const uniforms = this.device.createBuffer({ size: UNIFORM_FLOATS * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const entries: GPUBindGroupEntry[] = [{ binding: 0, resource: { buffer: uniforms } }];
    for (let slot = 0; slot < CHANNEL_COUNT; slot++) {
      entries.push(
        { binding: channelTextureBinding(slot), resource: this.emptyView },
        { binding: channelSamplerBinding(slot), resource: this.sampler },
      );
    }
    const now = performance.now();
    const icon: ShaderIcon = {
      canvas, context, pipeline, uniforms, themeColors,
      bindGroup: this.device.createBindGroup({ layout: this.bindGroupLayout, entries }),
      visible: false, startTime: now, lastTime: now, frame: 0, frameRate: 60,
    };
    this.icons.add(icon);
    this.canvasOwners.set(canvas, icon);

    return {
      setVisible: visible => {
        if (visible && !icon.visible) icon.lastTime = performance.now();
        icon.visible = visible;
        if (visible && !this.rafId) this.rafId = requestAnimationFrame(this.tick);
      },
      setThemeColors: colors => { icon.themeColors = colors; },
      renderAt: seconds => this.draw(icon, seconds, 0),
      destroy: () => {
        if (!this.icons.delete(icon)) return;
        uniforms.destroy();
        if (this.canvasOwners.get(canvas) === icon) {
          this.canvasOwners.delete(canvas);
          context.unconfigure();
        }
      },
    };
  }

  private tick = (now: number) => {
    const visible = [...this.icons].filter(icon => icon.visible);
    if (visible.length === 0) {
      this.rafId = 0;
      return;
    }
    this.rafId = requestAnimationFrame(this.tick);
    for (const icon of visible) {
      const delta = Math.max((now - icon.lastTime) / 1000, 1e-4);
      icon.lastTime = now;
      icon.frameRate = icon.frameRate * FRAME_RATE_SMOOTHING + (1 / delta) * (1 - FRAME_RATE_SMOOTHING);
      this.draw(icon, (now - icon.startTime) / 1000, delta);
    }
  };

  private draw(icon: ShaderIcon, seconds: number, delta: number) {
    const { canvas } = icon;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.floor(canvas.clientWidth * dpr);
    const height = Math.floor(canvas.clientHeight * dpr);
    if (width === 0 || height === 0) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const u = this.uniformData;
    const date = new Date();
    u.fill(0);
    u[0] = width;
    u[1] = height;
    u[2] = 1;
    u[3] = seconds;
    u[8] = delta;
    this.uniformInts[9] = icon.frame;
    u[10] = icon.frameRate;
    u[12] = date.getFullYear();
    u[13] = date.getMonth();
    u[14] = date.getDate();
    u[15] = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds() + date.getMilliseconds() / 1000;
    u.set(icon.themeColors, THEME_OFFSET);
    this.device.queue.writeBuffer(icon.uniforms, 0, u);

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: icon.context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }],
    });
    pass.setPipeline(icon.pipeline);
    pass.setBindGroup(0, icon.bindGroup);
    pass.draw(3);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
    icon.frame++;
  }
}

let shared: Promise<ThemeIconRenderer | null> | null = null;

/** The shared icon renderer, or null without WebGPU. A lost device is replaced on the next call. */
export function getThemeIconRenderer(): Promise<ThemeIconRenderer | null> {
  shared ??= (async () => {
    if (!navigator.gpu) return null;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return null;
      const device = await adapter.requestDevice();
      void device.lost.then(() => { shared = null; });
      return new ThemeIconRenderer(device);
    } catch (err) {
      console.warn('Theme shader icons are disabled:', err);
      shared = null;
      return null;
    }
  })();
  return shared;
}
