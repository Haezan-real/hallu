//src/features/shaders/shaderBackgroundRenderer.ts
import type { ShaderCompileError } from '../../shared/platform/electronApi';

// Hallu owns the vertex stage: one triangle that covers the whole canvas
const VERTEX_WGSL = `
@vertex
fn main(@builtin(vertex_index) index : u32) -> @builtin(position) vec4f {
  let corners = array(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(corners[index], 0.0, 1.0);
}
`;

// Mirrors HalluGlobals in shaderPacks.cjs (std140, 64 bytes)
const UNIFORM_FLOATS = 16;
const FRAME_RATE_SMOOTHING = 0.9;

/**
 * Draws the active shader pack's background surface onto one WebGPU canvas,
 * feeding it Shadertoy-style inputs (iResolution, iTime, iMouse, ...).
 */
export class ShaderBackgroundRenderer {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private format: GPUTextureFormat;
  private vertexModule: GPUShaderModule;
  private uniformBuffer: GPUBuffer;
  private uniforms = new Float32Array(UNIFORM_FLOATS);
  private uniformInts = new Int32Array(this.uniforms.buffer);
  private pipeline: GPURenderPipeline | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private rafId = 0;
  private latestShader = 0;
  private startTime = performance.now();
  private lastFrameTime = performance.now();
  private frame = 0;
  private frameRate = 60;
  private mouse = { x: 0, y: 0, clickX: 0, clickY: 0, down: false, clicked: false };
  private detachInput: () => void;

  private constructor(private canvas: HTMLCanvasElement, device: GPUDevice, context: GPUCanvasContext) {
    this.device = device;
    this.context = context;
    this.format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format: this.format, alphaMode: 'premultiplied' });
    this.vertexModule = device.createShaderModule({ code: VERTEX_WGSL });
    this.uniformBuffer = device.createBuffer({ size: UNIFORM_FLOATS * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.detachInput = this.attachMouse();
  }

  /** Returns null when WebGPU isn't available, leaving the canvas transparent. */
  static async create(canvas: HTMLCanvasElement): Promise<ShaderBackgroundRenderer | null> {
    if (!navigator.gpu) return null;
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return null;
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    if (!context) {
      device.destroy();
      return null;
    }
    return new ShaderBackgroundRenderer(canvas, device, context);
  }

  get lost(): Promise<GPUDeviceLostInfo> {
    return this.device.lost;
  }

  /**
   * Compiles WGSL into a pipeline and swaps it in. On failure the previous shader keeps
   * running and the errors are returned with line numbers relative to the author's file.
   */
  async setShader(wgsl: string, lineOffset: number): Promise<ShaderCompileError[] | null> {
    // A newer setShader call that finishes first must not be overwritten by this one
    const request = ++this.latestShader;
    const fragmentModule = this.device.createShaderModule({ code: wgsl });
    const info = await fragmentModule.getCompilationInfo();
    if (request !== this.latestShader) return null;
    const errors = info.messages
      .filter(message => message.type === 'error')
      .map(message => ({
        line: message.lineNum > lineOffset ? message.lineNum - lineOffset : null,
        message: message.message,
      }));
    if (errors.length > 0) return errors;

    try {
      const pipeline = await this.device.createRenderPipelineAsync({
        layout: 'auto',
        vertex: { module: this.vertexModule, entryPoint: 'main' },
        fragment: { module: fragmentModule, entryPoint: 'main', targets: [{ format: this.format }] },
        primitive: { topology: 'triangle-list' },
      });
      if (request !== this.latestShader) return null;
      this.pipeline = pipeline;
      this.bindGroup = this.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
      });
    } catch (err) {
      return [{ line: null, message: err instanceof Error ? err.message : String(err) }];
    }
    if (!this.rafId) this.rafId = requestAnimationFrame(this.render);
    return null;
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.detachInput();
    this.uniformBuffer.destroy();
    this.context.unconfigure();
    this.device.destroy();
  }

  private render = (now: number) => {
    this.rafId = requestAnimationFrame(this.render);
    if (!this.resize()) return;

    const delta = Math.max((now - this.lastFrameTime) / 1000, 1e-4);
    this.lastFrameTime = now;
    this.frameRate = this.frameRate * FRAME_RATE_SMOOTHING + (1 / delta) * (1 - FRAME_RATE_SMOOTHING);
    this.writeUniforms((now - this.startTime) / 1000, delta);
    this.frame++;
    this.encodePass();
  };

  private encodePass() {
    const { pipeline } = this;
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    if (pipeline && this.bindGroup) {
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, this.bindGroup);
      pass.draw(3);
    }
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  // Canvas pixels follow the element's CSS size times the device pixel ratio
  private resize(): boolean {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.floor(this.canvas.clientWidth * dpr);
    const height = Math.floor(this.canvas.clientHeight * dpr);
    if (width === 0 || height === 0) return false;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    return true;
  }

  private writeUniforms(time: number, delta: number) {
    const u = this.uniforms;
    const { mouse } = this;
    const date = new Date();
    u[0] = this.canvas.width;
    u[1] = this.canvas.height;
    u[2] = 1;
    u[3] = time;
    // Shadertoy convention: xy = position while held, z/w = click position, negative when released / after the click frame
    u[4] = mouse.x;
    u[5] = mouse.y;
    u[6] = mouse.down ? mouse.clickX : -mouse.clickX;
    u[7] = mouse.clicked ? mouse.clickY : -mouse.clickY;
    u[8] = delta;
    this.uniformInts[9] = this.frame;
    u[10] = this.frameRate;
    u[11] = 0;
    u[12] = date.getFullYear();
    u[13] = date.getMonth();
    u[14] = date.getDate();
    u[15] = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds() + date.getMilliseconds() / 1000;
    mouse.clicked = false;
    this.device.queue.writeBuffer(this.uniformBuffer, 0, u);
  }

  // Mouse in canvas pixels with a bottom-left origin, like fragCoord
  private attachMouse() {
    const toCanvas = (e: PointerEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      return { x: (e.clientX - rect.left) * dpr, y: (rect.bottom - e.clientY) * dpr };
    };
    const onDown = (e: PointerEvent) => {
      const p = toCanvas(e);
      Object.assign(this.mouse, { x: p.x, y: p.y, clickX: p.x, clickY: p.y, down: true, clicked: true });
    };
    const onMove = (e: PointerEvent) => {
      if (!this.mouse.down) return;
      const p = toCanvas(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
    };
    const onUp = () => { this.mouse.down = false; };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
    };
  }
}
