//src/features/shaders/glassCompositor.ts
import { MAX_GLASS_PANELS, type GlassRect } from './glassPanels';

const BLUR_FORMAT: GPUTextureFormat = 'rgba16float';
// Each level halves the image; the soft blur climbs back up from SOFT_DEPTH, the heavy one from the bottom
const BLUR_DEPTH = 3;
const SOFT_DEPTH = 1;
const DOWN_SPREAD = 1.0;
const UP_SPREAD = 0.75;
const PANEL_FLOATS = 8;
const HEADER_FLOATS = 8;
const COMPOSITE_FLOATS = HEADER_FLOATS + MAX_GLASS_PANELS * PANEL_FLOATS;

const BLUR_WGSL = /* wgsl */ `
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var linearSampler: sampler;
// xy: one over the output size, zw: tap offset in source uv
@group(0) @binding(2) var<uniform> blur: vec4f;

@vertex
fn fullscreen(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
  let corners = array(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(corners[index], 0.0, 1.0);
}

fn tap(uv: vec2f) -> vec4f {
  return textureSampleLevel(source, linearSampler, uv, 0.0);
}

// Dual Kawase: halve the image, spreading every texel over its neighbours
@fragment
fn down(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let uv = position.xy * blur.xy;
  let o = blur.zw;
  return (tap(uv) * 4.0 + tap(uv - o) + tap(uv + o) + tap(uv + vec2f(o.x, -o.y)) + tap(uv - vec2f(o.x, -o.y))) / 8.0;
}

@fragment
fn up(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let uv = position.xy * blur.xy;
  let o = blur.zw;
  var sum = tap(uv + vec2f(-2.0 * o.x, 0.0)) + tap(uv + vec2f(2.0 * o.x, 0.0))
    + tap(uv + vec2f(0.0, -2.0 * o.y)) + tap(uv + vec2f(0.0, 2.0 * o.y));
  sum += (tap(uv + o) + tap(uv - o) + tap(uv + vec2f(o.x, -o.y)) + tap(uv - vec2f(o.x, -o.y))) * 2.0;
  return sum / 12.0;
}
`;

const COMPOSITE_WGSL = /* wgsl */ `
struct Panel {
  rect: vec4f,   // left, top, width, height in canvas pixels
  shape: vec4f,  // x: corner radius
}

struct Glass {
  frame: vec4f,  // canvas width, height, canvas pixels per CSS pixel, panel count
  clock: vec4f,  // x: seconds
  panels: array<Panel, ${MAX_GLASS_PANELS}>,
}

@group(0) @binding(0) var scene: texture_2d<f32>;
@group(0) @binding(1) var softBlur: texture_2d<f32>;
@group(0) @binding(2) var heavyBlur: texture_2d<f32>;
@group(0) @binding(3) var linearSampler: sampler;
@group(0) @binding(4) var<uniform> glass: Glass;

// Lengths in CSS pixels
const BEVEL = 40.0;            // how far in from the edge the glass curves down
const THICKNESS = 26.0;        // how tall the curved rim is, which sets how far it bends the scene
// How fisheye the pane is: 0 is flat glass; higher magnifies the middle and squeezes the scene
// toward the rim
const FISHEYE = 0.35;
// How strong the lens flare is: 0 turns it off. Bright parts of the scene behind a pane bounce
// back as ghosts mirrored through its middle, a ring, and a glare around them
const LENS_FLARE = 0.6;
const FLARE_THRESHOLD = 0.45;  // how bright the scene must be to flare
const FLARE_GHOSTS = 4;
const FLARE_DISPERSAL = 0.38;  // spacing of the ghosts toward the middle of the pane
const FLARE_HALO = 0.6;        // ring radius, as a fraction of the pane's half size
const FLARE_HALO_DISPERSION = 0.05;
const DROP_SCALE = 450.0;      // CSS pixels per unit of the raindrop pattern
const DROP_REFRACTION = 3.0;   // how far a drop bends the view through it, in units of DROP_SCALE pixels
const SHADOW_OFFSET = 6.0;
const SHADOW_BLUR = 16.0;
const SHADOW_LIGHTNESS = 0.6;
const IOR = 0.72;
const DISPERSION = 0.03;
const CONTRAST = 1.12;
const LIGHTNESS = 0.025;
const LIGHT_HEIGHT = 0.3;
const RIM = 0.3;
const RIM_POWER = 4.0;
const RIM_SHARP = 0.5;
const RIM_SHARP_POWER = 40.0;
const EDGE = 0.12;

@vertex
fn fullscreen(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
  let corners = array(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(corners[index], 0.0, 1.0);
}

fn linearstep(e0: f32, e1: f32, x: f32) -> f32 {
  return clamp((x - e0) / (e1 - e0), 0.0, 1.0);
}

fn smin(a: f32, b: f32, k: f32) -> f32 {
  let k4 = 4.0 * k;
  let h = max(k4 - abs(a - b), 0.0) / k4;
  return min(a, b) - 0.25 * h * h * k4;
}

fn roundRect(p: vec2f, halfSize: vec2f, radius: f32) -> f32 {
  let q = abs(p) - halfSize + radius;
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - radius;
}

fn panelSdf(p: vec2f, panel: Panel) -> f32 {
  let halfSize = panel.rect.zw * 0.5;
  return roundRect(p - panel.rect.xy - halfSize, halfSize, panel.shape.x);
}

// Height of the rim x pixels in from the edge: a quarter ellipse rising to h over l pixels
fn droplet(x: f32, h: f32, l: f32) -> f32 {
  let t = h / l;
  let v = t * x * (2.0 * h - t * x);
  return select(h, sqrt(-smin(-v, 0.0, 8.0)), x < l);
}

// Smoothstep that also takes its edges in reverse order
fn ss(e0: f32, e1: f32, x: f32) -> f32 {
  let t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

fn hash1(t: f32) -> f32 {
  return fract(sin(t * 12345.564) * 7658.76);
}

fn hash3(p: f32) -> vec3f {
  var p3 = fract(vec3f(p) * vec3f(0.1031, 0.11369, 0.13787));
  p3 += dot(p3, p3.yzx + 19.19);
  return fract(vec3f((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
}

// Rises by b, then falls slowly back to 0 by 1
fn saw(b: f32, t: f32) -> f32 {
  return ss(0.0, b, t) * ss(1.0, b, t);
}

// Raindrops on the pane, after Martijn Steinrucken's "Heartfelt". uv has y up. In each column a
// drop clings, then lets go and slides down, wiggling and leaving a trail of beads behind it.
// Returns the drop coverage and how much its trail has wiped the glass
fn slidingDrops(uvIn: vec2f, t: f32) -> vec2f {
  let a = vec2f(6.0, 1.0);
  let grid = a * 2.0;
  var uv = uvIn;
  uv.y += t * 0.75;
  uv.y += hash1(floor(uv.x * grid.x));
  let id = floor(uv * grid);
  let n = hash3(id.x * 35.2 + id.y * 2376.1);
  let st = fract(uv * grid) - vec2f(0.5, 0.0);

  let wiggleY = uvIn.y * 20.0;
  var x = n.x - 0.5;
  x += sin(wiggleY + sin(wiggleY)) * (0.5 - abs(x)) * (n.z - 0.5);
  x *= 0.7;
  let y = (saw(0.85, fract(t + n.z)) - 0.5) * 0.9 + 0.5;

  let mainDrop = ss(0.4, 0.0, length((st - vec2f(x, y)) * a.yx));
  let r = sqrt(ss(1.0, y, st.y));
  let across = abs(st.x - x);
  let trailFront = ss(-0.02, 0.02, st.y - y);
  let trail = ss(0.23 * r, 0.15 * r * r, across) * trailFront * r * r;
  let beadY = fract(uvIn.y * 10.0) + (st.y - 0.5);
  let beads = ss(0.3, 0.0, length(st - vec2f(x, beadY)));
  return vec2f(mainDrop + beads * r * trailFront, trail);
}

// Fresh drops landing on the glass and slowly evaporating
fn landingDrops(uvIn: vec2f, t: f32) -> f32 {
  let uv = uvIn * 40.0;
  let id = floor(uv);
  let st = fract(uv) - 0.5;
  let n = hash3(id.x * 107.45 + id.y * 3543.654);
  let d = length(st - (n.xy - 0.5) * 0.7);
  return ss(0.3, 0.0, d) * fract(n.z * 10.0) * saw(0.025, fract(t + n.z));
}

fn rain(uv: vec2f, t: f32) -> vec2f {
  let landing = landingDrops(uv, t);
  let near = slidingDrops(uv, t);
  let far = slidingDrops(uv * 1.85, t);
  return vec2f(ss(0.3, 1.0, landing + near.x + far.x), max(near.y, far.y));
}

// The part of the (blurred) scene at p bright enough to flare
fn flareSource(p: vec2f) -> vec3f {
  let c = textureSampleLevel(heavyBlur, linearSampler, p / glass.frame.xy, 0.0).rgb;
  return max(c - FLARE_THRESHOLD, vec3f(0.0));
}

// Pseudo lens flare, after John Chapman, in the pane's own coordinates: local runs -1..1 across it
fn flare(p: vec2f, centre: vec2f, halfSize: vec2f, local: vec2f) -> vec3f {
  let tints = array(vec3f(1.0, 0.55, 0.25), vec3f(0.35, 0.8, 1.0), vec3f(0.85, 0.4, 1.0), vec3f(0.5, 1.0, 0.6));
  var col = vec3f(0.0);
  for (var i = 0; i < FLARE_GHOSTS; i++) {
    let ghost = -local * (1.0 - FLARE_DISPERSAL * f32(i));
    let weight = pow(max(1.0 - length(ghost) / 1.4142, 0.0), 5.0);
    col += flareSource(centre + ghost * halfSize) * tints[i % 4] * weight;
  }

  let toward = select(vec2f(0.0, 1.0), normalize(local), dot(local, local) > 1e-8);
  for (var c = 0; c < 3; c++) {
    let halo = -local + toward * FLARE_HALO * (1.0 + f32(c - 1) * FLARE_HALO_DISPERSION);
    let weight = pow(max(1.0 - length(halo) / 1.4142, 0.0), 5.0);
    col[c] += flareSource(centre + halo * halfSize)[c] * weight * 0.6;
  }
  return (col + flareSource(p) * 0.35) * LENS_FLARE;
}

// What shows through the glass at p: frosted, blurring more toward the corners, and clear
// where a drop or its trail has wiped it
fn behind(p: vec2f, vignette: f32, clarity: f32) -> vec3f {
  let uv = p / glass.frame.xy;
  let soft = textureSampleLevel(softBlur, linearSampler, uv, 0.0).rgb;
  let heavy = textureSampleLevel(heavyBlur, linearSampler, uv, 0.0).rgb;
  let sharp = textureSampleLevel(scene, linearSampler, uv, 0.0).rgb;
  return mix(mix(soft, heavy, vignette), sharp, clarity);
}

@fragment
fn composite(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let p = position.xy;
  let px = glass.frame.z;
  let base = textureSampleLevel(scene, linearSampler, p / glass.frame.xy, 0.0);
  let ldir = normalize(vec3f(-0.6, -0.8, LIGHT_HEIGHT));

  // The nearest panel gets drawn; every panel casts a shadow, falling away from the light
  var nearest = 0u;
  var sdf = 1e9;
  var shadow = 1.0;
  let shadowBlur = SHADOW_BLUR * px;
  let count = u32(glass.frame.w);
  for (var i = 0u; i < count; i++) {
    let panel = glass.panels[i];
    let d = panelSdf(p, panel);
    if (d < sdf) {
      sdf = d;
      nearest = i;
    }
    let s = abs(panelSdf(p + normalize(ldir.xy) * SHADOW_OFFSET * px, panel)) - 0.33 * shadowBlur;
    shadow *= mix(SHADOW_LIGHTNESS, 1.0, linearstep(-shadowBlur, shadowBlur, s));
  }

  let edge = EDGE * linearstep(px, -px, abs(sdf) - px);
  let mask = linearstep(0.75 * px, -0.75 * px, sdf);
  if (mask <= 0.0) {
    return vec4f(base.rgb * shadow + edge, base.a);
  }

  let panel = glass.panels[nearest];
  let bevel = BEVEL * px;
  let thickness = THICKNESS * px;
  let h = droplet(-sdf, thickness, bevel);
  let dhdx = droplet(-panelSdf(p + vec2f(1.0, 0.0), panel), thickness, bevel) - h;
  let dhdy = droplet(-panelSdf(p + vec2f(0.0, 1.0), panel), thickness, bevel) - h;
  let ndir = normalize(vec3f(-dhdx, -dhdy, 1.0));

  let halfSize = panel.rect.zw * 0.5;
  let fromCentre = p - panel.rect.xy - halfSize;
  let local = fromCentre / halfSize;
  let r2 = dot(local, local) * 0.5;
  let vignette = smoothstep(0.3, 1.0, r2);
  // Fisheye: a point r of the way to the corner shows the scene from r^(1 + FISHEYE) of the way
  let reach = length(fromCentre) / length(halfSize);
  let lens = fromCentre * (pow(max(reach, 1e-4), FISHEYE) - 1.0);

  // Drops on the outside of the pane; their slope, by finite differences, bends the view like a lens
  let dropUnit = DROP_SCALE * px;
  let dropUv = vec2f(p.x, -p.y) / dropUnit;
  let t = glass.clock.x * 0.2;
  let drops = rain(dropUv, t);
  let e = 1.0 / dropUnit;
  let slope = vec2f(rain(dropUv + vec2f(e, 0.0), t).x - drops.x, drops.x - rain(dropUv + vec2f(0.0, e), t).x);
  let dropBend = slope * DROP_REFRACTION * dropUnit;
  let clarity = max(ss(0.1, 0.2, drops.x), drops.y * 0.7);

  // The rim works as a lens too: each channel bends a little differently
  var col = vec3f(0.0);
  for (var i = 0; i < 3; i++) {
    let odir = refract(vec3f(0.0, 0.0, -1.0), ndir, IOR + f32(i) * DISPERSION);
    let rimBend = -clamp(odir.xy / odir.z, vec2f(-4.0), vec2f(4.0)) * thickness;
    let spread = 1.0 + f32(i - 1) * DISPERSION;
    col[i] = behind(p + (rimBend + lens + dropBend) * spread, vignette, clarity)[i];
  }
  // Drops gather a little light along their lower edge
  col += vec3f(0.08) * ss(0.0, 20.0, -slope.y * dropUnit) * ss(0.05, 0.3, drops.x);
  col *= shadow;
  col = pow(max(col, vec3f(0.0)), vec3f(CONTRAST)) + LIGHTNESS;
  let rim = abs(dot(ndir, ldir));
  col += RIM * pow(rim, RIM_POWER) + RIM_SHARP * pow(rim, RIM_SHARP_POWER);
  if (LENS_FLARE > 0.0) {
    col += flare(p, panel.rect.xy + halfSize, halfSize, local);
  }

  return vec4f(mix(base.rgb * shadow, col, mask) + edge, max(base.a, mask));
}
`;

interface BlurStep {
  pipeline: GPURenderPipeline;
  target: GPUTextureView;
  bindGroup: GPUBindGroup;
}

/**
 * Frosted glass behind registered UI panels: the shader pack draws into sceneView, which is
 * blurred at two strengths and drawn to the canvas with glass panels on top.
 */
export class GlassCompositor {
  private down: GPURenderPipeline;
  private up: GPURenderPipeline;
  private composite: GPURenderPipeline;
  private sampler: GPUSampler;
  private compositeUniforms: GPUBuffer;
  private compositeData = new Float32Array(COMPOSITE_FLOATS);
  private compositeGroup: GPUBindGroup | null = null;
  private textures: GPUTexture[] = [];
  private buffers: GPUBuffer[] = [];
  private steps: BlurStep[] = [];
  private width = 0;
  private height = 0;
  sceneView: GPUTextureView | null = null;

  constructor(private device: GPUDevice, private format: GPUTextureFormat) {
    const blurModule = device.createShaderModule({ code: BLUR_WGSL });
    const blurPipeline = (entryPoint: string) => device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: blurModule, entryPoint: 'fullscreen' },
      fragment: { module: blurModule, entryPoint, targets: [{ format: BLUR_FORMAT }] },
      primitive: { topology: 'triangle-list' },
    });
    this.down = blurPipeline('down');
    this.up = blurPipeline('up');
    const compositeModule = device.createShaderModule({ code: COMPOSITE_WGSL });
    this.composite = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: compositeModule, entryPoint: 'fullscreen' },
      fragment: { module: compositeModule, entryPoint: 'composite', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });
    this.sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
    this.compositeUniforms = device.createBuffer({ size: COMPOSITE_FLOATS * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  }

  /** Rebuilds the scene and blur textures when the canvas size changes */
  resize(width: number, height: number) {
    if (width === this.width && height === this.height) return;
    this.releaseTargets();
    this.width = width;
    this.height = height;

    const scene = this.createTexture(width, height, this.format);
    this.sceneView = scene.createView();
    const levels = [{ view: this.sceneView, width, height }];
    for (let depth = 1; depth <= BLUR_DEPTH; depth++) {
      const levelWidth = Math.max(1, Math.ceil(width / 2 ** depth));
      const levelHeight = Math.max(1, Math.ceil(height / 2 ** depth));
      levels.push({ view: this.createTexture(levelWidth, levelHeight, BLUR_FORMAT).createView(), width: levelWidth, height: levelHeight });
    }
    for (let depth = 1; depth <= BLUR_DEPTH; depth++) {
      this.addStep(this.down, levels[depth - 1], levels[depth], DOWN_SPREAD);
    }
    const climb = (from: number) => {
      let source = levels[from];
      for (let depth = from - 1; depth >= 1; depth--) {
        const target = { ...levels[depth], view: this.createTexture(levels[depth].width, levels[depth].height, BLUR_FORMAT).createView() };
        this.addStep(this.up, source, target, UP_SPREAD);
        source = target;
      }
      return source.view;
    };
    const soft = climb(SOFT_DEPTH);
    const heavy = climb(BLUR_DEPTH);

    this.compositeGroup = this.device.createBindGroup({
      layout: this.composite.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.sceneView },
        { binding: 1, resource: soft },
        { binding: 2, resource: heavy },
        { binding: 3, resource: this.sampler },
        { binding: 4, resource: { buffer: this.compositeUniforms } },
      ],
    });
  }

  /** Blurs sceneView and draws it to the canvas with the panels' glass on top */
  encode(encoder: GPUCommandEncoder, canvasView: GPUTextureView, panels: GlassRect[], pixelsPerCssPixel: number, seconds: number) {
    if (!this.compositeGroup) return;
    const data = this.compositeData;
    data.fill(0);
    data.set([this.width, this.height, pixelsPerCssPixel, panels.length, seconds], 0);
    panels.forEach((panel, index) => {
      data.set([panel.x, panel.y, panel.width, panel.height, panel.radius], HEADER_FLOATS + index * PANEL_FLOATS);
    });
    this.device.queue.writeBuffer(this.compositeUniforms, 0, data);

    for (const step of this.steps) this.draw(encoder, step.pipeline, step.bindGroup, step.target);
    this.draw(encoder, this.composite, this.compositeGroup, canvasView);
  }

  destroy() {
    this.releaseTargets();
    this.compositeUniforms.destroy();
  }

  private draw(encoder: GPUCommandEncoder, pipeline: GPURenderPipeline, bindGroup: GPUBindGroup, view: GPUTextureView) {
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
  }

  private addStep(
    pipeline: GPURenderPipeline,
    source: { view: GPUTextureView; width: number; height: number },
    target: { view: GPUTextureView; width: number; height: number },
    spread: number,
  ) {
    const uniforms = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(uniforms, 0, new Float32Array([1 / target.width, 1 / target.height, spread / source.width, spread / source.height]));
    this.buffers.push(uniforms);
    this.steps.push({
      pipeline,
      target: target.view,
      bindGroup: this.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: source.view },
          { binding: 1, resource: this.sampler },
          { binding: 2, resource: { buffer: uniforms } },
        ],
      }),
    });
  }

  private createTexture(width: number, height: number, format: GPUTextureFormat): GPUTexture {
    const texture = this.device.createTexture({
      size: [width, height],
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.textures.push(texture);
    return texture;
  }

  private releaseTargets() {
    this.textures.forEach(texture => texture.destroy());
    this.buffers.forEach(buffer => buffer.destroy());
    this.textures = [];
    this.buffers = [];
    this.steps = [];
    this.compositeGroup = null;
    this.sceneView = null;
    this.width = 0;
    this.height = 0;
  }
}
