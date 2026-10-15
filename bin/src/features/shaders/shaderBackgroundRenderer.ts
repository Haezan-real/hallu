//src/features/shaders/shaderBackgroundRenderer.ts
import type {
  CompiledShaderPass,
  CompiledShaderSurface,
  ShaderChannel,
  ShaderCompileError,
} from '../../shared/platform/electronApi';
import { THEME_FLOATS, ThemeColorFade } from './themeColorFade';

// Hallu owns the vertex stage: one triangle that covers the whole target
export const VERTEX_WGSL = `
@vertex
fn main(@builtin(vertex_index) index : u32) -> @builtin(position) vec4f {
  let corners = array(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(corners[index], 0.0, 1.0);
}
`;

// Mirrors HalluGlobals and the binding numbers in shaderPacks.cjs (std140, 400 bytes)
const CHANNEL_RESOLUTION_OFFSET = 16;
export const THEME_OFFSET = 32;
export const UNIFORM_FLOATS = THEME_OFFSET + THEME_FLOATS;
export const CHANNEL_COUNT = 4;
const OUTPUT_BINDING = 9;
const STORAGE_BINDING = 10;
export const channelTextureBinding = (slot: number) => 1 + slot * 2;
export const channelSamplerBinding = (slot: number) => 2 + slot * 2;

// Full float precision so simulations can keep positions and velocities in buffers
const BUFFER_FORMAT: GPUTextureFormat = 'rgba32float';
const BUFFER_USAGE = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST;
const EMPTY_STORAGE_BYTES = 256;
const FRAME_RATE_SMOOTHING = 0.9;

export interface ShaderProgramError {
  file: string;
  errors: ShaderCompileError[];
}

export type ReadShaderAsset = (file: string) => Promise<Uint8Array>;

interface TextureInput {
  view: GPUTextureView;
  width: number;
  height: number;
}

// Two textures per buffer: passes read the latest one and write the other, then they swap
interface PassTarget {
  textures: GPUTexture[];
  views: GPUTextureView[];
  current: number;
}

interface RuntimePass {
  info: CompiledShaderPass;
  render: GPURenderPipeline | null;
  compute: GPUComputePipeline | null;
  uniforms: GPUBuffer;
  samplers: GPUSampler[];
  target: PassTarget | null;
}

interface Program {
  passes: RuntimePass[];
  targets: Map<string, PassTarget>;
  images: Map<string, TextureInput & { texture: GPUTexture }>;
  storage: GPUBuffer | null;
  width: number;
  height: number;
}

type PipelineResult = { render: GPURenderPipeline | null; compute: GPUComputePipeline | null } | ShaderProgramError;

const isProgramError = (value: object): value is ShaderProgramError => 'errors' in value;
const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));
const imageKey = (channel: ShaderChannel) => `${channel.source}|${channel.kind === 'image' && channel.flipY}`;

/**
 * Runs a shader pack's background surface on one WebGPU canvas: buffer and compute
 * passes in manifest order, then the screen pass, with Shadertoy-style inputs.
 */
export class ShaderBackgroundRenderer {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private format: GPUTextureFormat;
  private filterable: boolean;
  private bindGroupLayout: GPUBindGroupLayout;
  private pipelineLayout: GPUPipelineLayout;
  private vertexModule: GPUShaderModule;
  private emptyView: GPUTextureView;
  private emptyOutputView: GPUTextureView;
  private emptyStorage: GPUBuffer;
  private emptySampler: GPUSampler;
  private uniforms = new Float32Array(UNIFORM_FLOATS);
  private uniformInts = new Int32Array(this.uniforms.buffer);
  private program: Program | null = null;
  private rafId = 0;
  private latestProgram = 0;
  private destroyed = false;
  private startTime = performance.now();
  private lastFrameTime = performance.now();
  private frame = 0;
  private frameRate = 60;
  private mouse = { x: 0, y: 0, clickX: 0, clickY: 0, down: false, clicked: false };
  private theme = new ThemeColorFade();
  private detachInput: () => void;

  private constructor(private canvas: HTMLCanvasElement, device: GPUDevice, context: GPUCanvasContext, filterable: boolean) {
    this.device = device;
    this.context = context;
    this.filterable = filterable;
    this.format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format: this.format, alphaMode: 'premultiplied' });
    this.vertexModule = device.createShaderModule({ code: VERTEX_WGSL });
    this.bindGroupLayout = this.createBindGroupLayout();
    this.pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout] });
    // Placeholders for unused channels, compute passes nobody reads and packs without storage
    this.emptyView = device.createTexture({ size: [1, 1], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING }).createView();
    this.emptyOutputView = device.createTexture({ size: [1, 1], format: BUFFER_FORMAT, usage: GPUTextureUsage.STORAGE_BINDING }).createView();
    this.emptyStorage = device.createBuffer({ size: EMPTY_STORAGE_BYTES, usage: GPUBufferUsage.STORAGE });
    this.emptySampler = device.createSampler();
    this.detachInput = this.attachMouse();
  }

  /** Returns null when WebGPU isn't available, leaving the canvas transparent. */
  static async create(canvas: HTMLCanvasElement): Promise<ShaderBackgroundRenderer | null> {
    if (!navigator.gpu) return null;
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return null;
    // Without float32-filterable, float buffers can only be read with nearest filtering
    const filterable = adapter.features.has('float32-filterable');
    const device = await adapter.requestDevice({
      requiredFeatures: filterable ? ['float32-filterable'] : [],
      requiredLimits: {
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
        maxBufferSize: adapter.limits.maxBufferSize,
      },
    });
    const context = canvas.getContext('webgpu');
    if (!context) {
      device.destroy();
      return null;
    }
    return new ShaderBackgroundRenderer(canvas, device, context, filterable);
  }

  get lost(): Promise<GPUDeviceLostInfo> {
    return this.device.lost;
  }

  /**
   * Builds every pass and swaps the program in. On failure the previous program keeps
   * running and the first error is returned.
   */
  async setProgram(surface: CompiledShaderSurface, readAsset: ReadShaderAsset): Promise<ShaderProgramError | null> {
    // A newer setProgram call that finishes first must not be overwritten by this one
    const request = ++this.latestProgram;
    const built = await this.buildProgram(surface, readAsset);
    if (isProgramError(built)) return request === this.latestProgram ? built : null;
    if (request !== this.latestProgram || this.destroyed) {
      this.destroyProgram(built);
      return null;
    }
    if (this.program) this.destroyProgram(this.program);
    this.program = built;
    this.frame = 0;
    if (!this.rafId) this.rafId = requestAnimationFrame(this.render);
    return null;
  }

  /** Stops drawing and leaves the canvas transparent; also cancels a setProgram still building */
  clearProgram() {
    this.latestProgram++;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    if (this.program) this.destroyProgram(this.program);
    this.program = null;
    if (!this.resize()) return;
    const encoder = this.device.createCommandEncoder();
    encoder.beginRenderPass({
      colorAttachments: [{ view: this.context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }],
    }).end();
    this.device.queue.submit([encoder.finish()]);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.detachInput();
    this.theme.disconnect();
    if (this.program) this.destroyProgram(this.program);
    this.program = null;
    this.context.unconfigure();
    this.device.destroy();
  }

  private createBindGroupLayout(): GPUBindGroupLayout {
    const stages = GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE;
    const entries: GPUBindGroupLayoutEntry[] = [{ binding: 0, visibility: stages, buffer: { type: 'uniform' } }];
    for (let slot = 0; slot < CHANNEL_COUNT; slot++) {
      entries.push(
        { binding: channelTextureBinding(slot), visibility: stages, texture: { sampleType: this.filterable ? 'float' : 'unfilterable-float' } },
        { binding: channelSamplerBinding(slot), visibility: stages, sampler: { type: this.filterable ? 'filtering' : 'non-filtering' } },
      );
    }
    entries.push(
      { binding: OUTPUT_BINDING, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: BUFFER_FORMAT } },
      { binding: STORAGE_BINDING, visibility: stages, buffer: { type: 'storage' } },
    );
    return this.device.createBindGroupLayout({ entries });
  }

  private async buildProgram(surface: CompiledShaderSurface, readAsset: ReadShaderAsset): Promise<Program | ShaderProgramError> {
    const program: Program = { passes: [], targets: new Map(), images: new Map(), storage: null, width: 1, height: 1 };
    const fail = (error: ShaderProgramError) => {
      this.destroyProgram(program);
      return error;
    };

    this.resize();
    program.width = this.canvas.width;
    program.height = this.canvas.height;

    for (const channel of surface.passes.flatMap(pass => pass.channels)) {
      if (channel?.kind !== 'image' || program.images.has(imageKey(channel))) continue;
      try {
        program.images.set(imageKey(channel), await this.loadImage(channel, readAsset));
      } catch (err) {
        return fail({ file: channel.source, errors: [{ line: null, message: `couldn't load image: ${errorMessage(err)}` }] });
      }
    }

    if (surface.storage > this.device.limits.maxStorageBufferBindingSize) {
      return fail({ file: 'manifest.json', errors: [{ line: null, message: `"storage" is larger than this GPU allows (${this.device.limits.maxStorageBufferBindingSize} bytes)` }] });
    }
    if (surface.storage > 0) {
      program.storage = this.device.createBuffer({ size: surface.storage, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    }

    // Compute passes only need an output texture when another pass reads it
    const readPasses = new Set(surface.passes.flatMap(pass => pass.channels).filter(c => c?.kind === 'pass').map(c => c!.source));
    for (const pass of surface.passes) {
      if (pass.name && (pass.kind === 'buffer' || readPasses.has(pass.name))) {
        program.targets.set(pass.name, this.createTarget(program.width, program.height));
      }
      if (pass.kind === 'compute' && !pass.dispatch && !pass.workgroupSize) {
        return fail({ file: pass.file, errors: [{ line: null, message: 'couldn\'t read the workgroup size; add "dispatch": [x, y, z] to this pass' }] });
      }
    }

    const pipelines = await Promise.all(surface.passes.map(pass => this.buildPipeline(pass)));
    for (const [index, info] of surface.passes.entries()) {
      const pipeline = pipelines[index];
      if (isProgramError(pipeline)) return fail(pipeline);
      program.passes.push({
        info,
        ...pipeline,
        uniforms: this.device.createBuffer({ size: UNIFORM_FLOATS * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }),
        samplers: Array.from({ length: CHANNEL_COUNT }, (_, slot) => this.createSampler(info.channels[slot] ?? null)),
        target: info.name ? program.targets.get(info.name) ?? null : null,
      });
    }
    return program;
  }

  private async buildPipeline(pass: CompiledShaderPass): Promise<PipelineResult> {
    const module = this.device.createShaderModule({ code: pass.wgsl });
    const info = await module.getCompilationInfo();
    const errors = info.messages
      .filter(message => message.type === 'error')
      .map(message => ({
        line: pass.lineOffset !== null && message.lineNum > pass.lineOffset ? message.lineNum - pass.lineOffset : null,
        message: message.message,
      }));
    if (errors.length > 0) return { file: pass.file, errors };

    try {
      if (pass.kind === 'compute') {
        const compute = await this.device.createComputePipelineAsync({
          layout: this.pipelineLayout,
          compute: { module, entryPoint: 'main' },
        });
        return { render: null, compute };
      }
      const render = await this.device.createRenderPipelineAsync({
        layout: this.pipelineLayout,
        vertex: { module: this.vertexModule, entryPoint: 'main' },
        fragment: { module, entryPoint: 'main', targets: [{ format: pass.kind === 'image' ? this.format : BUFFER_FORMAT }] },
        primitive: { topology: 'triangle-list' },
      });
      return { render, compute: null };
    } catch (err) {
      return { file: pass.file, errors: [{ line: null, message: errorMessage(err) }] };
    }
  }

  private async loadImage(channel: ShaderChannel & { kind: 'image' }, readAsset: ReadShaderAsset) {
    const bytes = await readAsset(channel.source);
    const bitmap = await createImageBitmap(new Blob([bytes as BlobPart]), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    try {
      const texture = this.device.createTexture({
        size: [bitmap.width, bitmap.height],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      });
      // flipY stores the bottom row first, matching Shadertoy's uv origin
      this.device.queue.copyExternalImageToTexture({ source: bitmap, flipY: channel.flipY }, { texture }, [bitmap.width, bitmap.height]);
      return { texture, view: texture.createView(), width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  }

  private createTarget(width: number, height: number): PassTarget {
    const textures = [0, 1].map(() => this.device.createTexture({ size: [width, height], format: BUFFER_FORMAT, usage: BUFFER_USAGE }));
    return { textures, views: textures.map(texture => texture.createView()), current: 0 };
  }

  private createSampler(channel: ShaderChannel | null): GPUSampler {
    if (!channel) return this.emptySampler;
    const filter: GPUFilterMode = this.filterable && channel.filter === 'linear' ? 'linear' : 'nearest';
    const address: GPUAddressMode = channel.wrap === 'repeat' ? 'repeat' : 'clamp-to-edge';
    return this.device.createSampler({ magFilter: filter, minFilter: filter, addressModeU: address, addressModeV: address });
  }

  private destroyProgram(program: Program) {
    for (const target of program.targets.values()) target.textures.forEach(texture => texture.destroy());
    for (const image of program.images.values()) image.texture.destroy();
    for (const pass of program.passes) pass.uniforms.destroy();
    program.storage?.destroy();
  }

  private render = (now: number) => {
    this.rafId = requestAnimationFrame(this.render);
    const { program } = this;
    if (!program || !this.resize()) return;

    const delta = Math.max((now - this.lastFrameTime) / 1000, 1e-4);
    this.lastFrameTime = now;
    this.frameRate = this.frameRate * FRAME_RATE_SMOOTHING + (1 / delta) * (1 - FRAME_RATE_SMOOTHING);
    this.resizeTargets(program);
    this.writeGlobals(now, delta);

    const encoder = this.device.createCommandEncoder();
    for (const pass of program.passes) this.encodePass(encoder, program, pass);
    this.device.queue.submit([encoder.finish()]);
    this.mouse.clicked = false;
    this.frame++;
  };

  private channelInput(program: Program, channel: ShaderChannel | null): TextureInput | null {
    if (!channel) return null;
    if (channel.kind === 'image') return program.images.get(imageKey(channel)) ?? null;
    const target = program.targets.get(channel.source);
    return target ? { view: target.views[target.current], width: program.width, height: program.height } : null;
  }

  private encodePass(encoder: GPUCommandEncoder, program: Program, pass: RuntimePass) {
    const { target } = pass;
    const writeIndex = target ? 1 - target.current : 0;
    const inputs = Array.from({ length: CHANNEL_COUNT }, (_, slot) => this.channelInput(program, pass.info.channels[slot] ?? null));

    const u = this.uniforms;
    inputs.forEach((input, slot) => {
      const offset = CHANNEL_RESOLUTION_OFFSET + slot * 4;
      u[offset] = input?.width ?? 0;
      u[offset + 1] = input?.height ?? 0;
      u[offset + 2] = input ? 1 : 0;
    });
    this.device.queue.writeBuffer(pass.uniforms, 0, u);

    const entries: GPUBindGroupEntry[] = [{ binding: 0, resource: { buffer: pass.uniforms } }];
    inputs.forEach((input, slot) => {
      entries.push(
        { binding: channelTextureBinding(slot), resource: input?.view ?? this.emptyView },
        { binding: channelSamplerBinding(slot), resource: pass.samplers[slot] },
      );
    });
    const output = pass.compute && target ? target.views[writeIndex] : this.emptyOutputView;
    entries.push(
      { binding: OUTPUT_BINDING, resource: output },
      { binding: STORAGE_BINDING, resource: { buffer: program.storage ?? this.emptyStorage } },
    );
    const bindGroup = this.device.createBindGroup({ layout: this.bindGroupLayout, entries });

    if (pass.compute) {
      // Texels the compute shader doesn't write keep last frame's value
      if (target) {
        encoder.copyTextureToTexture({ texture: target.textures[target.current] }, { texture: target.textures[writeIndex] }, [program.width, program.height]);
      }
      const computePass = encoder.beginComputePass();
      computePass.setPipeline(pass.compute);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(...this.dispatchSize(pass.info, program));
      computePass.end();
    } else if (pass.render) {
      const view = target ? target.views[writeIndex] : this.context.getCurrentTexture().createView();
      const renderPass = encoder.beginRenderPass({
        colorAttachments: [{ view, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }],
      });
      renderPass.setPipeline(pass.render);
      renderPass.setBindGroup(0, bindGroup);
      renderPass.draw(3);
      renderPass.end();
    }
    if (target) target.current = writeIndex;
  }

  // Without an explicit "dispatch", compute passes get one invocation per pixel
  private dispatchSize(pass: CompiledShaderPass, program: Program): [number, number, number] {
    if (pass.dispatch) return pass.dispatch;
    const [x, y] = pass.workgroupSize ?? [1, 1, 1];
    return [Math.ceil(program.width / x), Math.ceil(program.height / y), 1];
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

  // Buffers follow the canvas size, keeping the overlapping region so simulations survive a resize
  private resizeTargets(program: Program) {
    const { width, height } = this.canvas;
    if (program.width === width && program.height === height) return;
    const encoder = this.device.createCommandEncoder();
    const old: GPUTexture[] = [];
    for (const target of program.targets.values()) {
      const resized = this.createTarget(width, height);
      encoder.copyTextureToTexture(
        { texture: target.textures[target.current] },
        { texture: resized.textures[0] },
        [Math.min(width, program.width), Math.min(height, program.height)],
      );
      old.push(...target.textures);
      Object.assign(target, resized);
    }
    this.device.queue.submit([encoder.finish()]);
    old.forEach(texture => texture.destroy());
    program.width = width;
    program.height = height;
  }

  private writeGlobals(now: number, delta: number) {
    const u = this.uniforms;
    const { mouse } = this;
    const date = new Date();
    u[0] = this.canvas.width;
    u[1] = this.canvas.height;
    u[2] = 1;
    u[3] = (now - this.startTime) / 1000;
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
    u.set(this.theme.sample(now), THEME_OFFSET);
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
