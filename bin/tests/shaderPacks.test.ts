import { existsSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  allowStorageWrites,
  cacheKey,
  hasEntryPoint,
  normalizeSurface,
  parseGlslangErrors,
  parseTintErrors,
  parseWorkgroupSize,
  translateGlsl,
  validateManifest,
  defineConstants,
  wgslPreludeLines,
  wrapGlsl,
  wrapWgsl,
  MAX_PANELS,
} from '../shaderPacks.cjs';

const MAIN_IMAGE = 'void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n  fragColor = vec4(fragCoord / iResolution.xy, 0.5 + 0.5 * sin(iTime), 1.0);\n}\n';
const toolsInstalled = existsSync(join(__dirname, '..', 'tools', 'shader', 'tint.exe'));

describe('shader boilerplate', () => {
  it('resets line numbers so errors point at the author\'s file', () => {
    const wrapped = wrapGlsl(MAIN_IMAGE);
    expect(wrapped.startsWith('#version 460')).toBe(true);
    expect(wrapped).toContain(`#line 1\n${MAIN_IMAGE}`);
  });

  it('flips fragCoord only for the screen pass', () => {
    expect(wrapGlsl(MAIN_IMAGE, 'image')).toContain('mainImage(color, vec2(gl_FragCoord.x, iResolution.y - gl_FragCoord.y))');
    expect(wrapGlsl(MAIN_IMAGE, 'buffer')).toContain('mainImage(color, gl_FragCoord.xy)');
  });

  it('gives compute passes an output image and no generated main', () => {
    const wrapped = wrapGlsl('layout(local_size_x = 8) in;\nvoid main() {}\n', 'compute');
    expect(wrapped).toContain('uniform writeonly image2D iOutput');
    expect(wrapped).not.toContain('halluFragColor');
  });

  it('gives geometry passes read-only storage and flips the vertex position into buffer rows', () => {
    const vertex = wrapGlsl('vec4 mainVertex(int vertexIndex, int instanceIndex) { return vec4(0.0); }\n', 'vertex');
    expect(vertex).toContain('readonly buffer');
    expect(vertex).toContain('gl_Position = vec4(position.x, -position.y, position.z, position.w)');
    expect(wrapGlsl(MAIN_IMAGE, 'geometry')).toContain('readonly buffer');
    expect(wrapGlsl(MAIN_IMAGE, 'buffer')).not.toContain('readonly buffer');
  });

  it('reports how many WGSL boilerplate lines precede the author\'s code', () => {
    const source = 'fn mainImage(fragCoord : vec2f) -> vec4f { return vec4f(1.0); }';
    for (const kind of ['image', 'buffer', 'compute'] as const) {
      expect(wrapWgsl(source, kind).split('\n')[wgslPreludeLines(kind)]).toBe(source);
    }
  });

  it('detects the entry point per language and pass kind', () => {
    expect(hasEntryPoint(MAIN_IMAGE, 'glsl', 'image')).toBe(true);
    expect(hasEntryPoint('void main() {}', 'glsl', 'image')).toBe(false);
    expect(hasEntryPoint('void main() {}', 'glsl', 'compute')).toBe(true);
    expect(hasEntryPoint('fn mainImage(fragCoord : vec2f) -> vec4f {}', 'wgsl', 'buffer')).toBe(true);
    expect(hasEntryPoint('@compute @workgroup_size(8) fn main() {}', 'wgsl', 'compute')).toBe(true);
    expect(hasEntryPoint('vec4 mainVertex(int v, int i) { return vec4(0.0); }', 'glsl', 'vertex')).toBe(true);
    expect(hasEntryPoint(MAIN_IMAGE, 'glsl', 'vertex')).toBe(false);
  });

  it('turns read-only storage declarations into the read-write binding Hallu provides', () => {
    expect(allowStorageWrites('@group(0u) @binding(10u) var<storage, read> v : Stats;'))
      .toBe('@group(0u) @binding(10u) var<storage, read_write> v : Stats;');
    expect(allowStorageWrites('@group(0) @binding(10) var<storage, read_write> v : Stats;'))
      .toBe('@group(0) @binding(10) var<storage, read_write> v : Stats;');
  });

  it('declares sixteen panel rects with their kind and floating flags', () => {
    expect(MAX_PANELS).toBe(16);
    const glsl = wrapGlsl(MAIN_IMAGE);
    expect(glsl).toContain('vec4 iPanels[16];\n  ivec4 iPanelInfo[16];\n  int iPanelCount;');
    const wgsl = wrapWgsl('fn mainImage(fragCoord : vec2f) -> vec4f { return vec4f(1.0); }');
    expect(wgsl).toContain('iPanels : array<vec4f, 16>,\n  iPanelInfo : array<vec4i, 16>,\n  iPanelCount : i32,');
  });

  it('reads literal workgroup sizes from WGSL', () => {
    expect(parseWorkgroupSize('@compute @workgroup_size(8u, 8u, 1u)\nfn main() {}')).toEqual([8, 8, 1]);
    expect(parseWorkgroupSize('@compute @workgroup_size(64)\nfn main() {}')).toEqual([64, 1, 1]);
    expect(parseWorkgroupSize('@compute @workgroup_size(SIZE)\nfn main() {}')).toBeNull();
  });
});

describe('compiler error parsing', () => {
  it('extracts glslang line numbers and drops the summary lines', () => {
    const output = [
      'C:\\tmp\\shader.frag',
      "ERROR: C:\\tmp\\shader.frag:6: 'undefinedThing' : undeclared identifier ",
      "ERROR: C:\\tmp\\shader.frag:6: '' : compilation terminated ",
      'ERROR: 2 compilation errors.  No code generated.',
      'ERROR: Linking fragment stage: Missing entry point: Each stage requires one entry point',
      'SPIR-V is not generated for failed compile or link',
    ].join('\n');
    expect(parseGlslangErrors(output)).toEqual([{ line: 6, message: "'undefinedThing' : undeclared identifier" }]);
  });

  it('keeps tint errors and notes but not the IR dump', () => {
    const output = [
      'Failed to convert IR to Program:',
      '',
      "error: 'dpdx' must only be called from uniform control flow",
      'note: control flow depends on possibly non-uniform value',
      '',
      'HalluGlobals = struct @align(16) {',
      '  iResolution:vec3<f32> @offset(0)',
    ].join('\n');
    expect(parseTintErrors(output)).toEqual([
      { line: null, message: "'dpdx' must only be called from uniform control flow (control flow depends on possibly non-uniform value)" },
    ]);
  });

  it('explains WebGPU restrictions in plain words', () => {
    const [error] = parseTintErrors('error: f64 type is not supported');
    expect(error.message).toMatch(/^double precision isn't supported/);
  });
});

describe('shader cache key', () => {
  it('changes when the source, pass kind or tool versions change', () => {
    const base = cacheKey(MAIN_IMAGE, 'glsl', 'image', 'tools-a');
    expect(cacheKey(MAIN_IMAGE, 'glsl', 'image', 'tools-a')).toBe(base);
    expect(cacheKey(`${MAIN_IMAGE} `, 'glsl', 'image', 'tools-a')).not.toBe(base);
    expect(cacheKey(MAIN_IMAGE, 'glsl', 'buffer', 'tools-a')).not.toBe(base);
    expect(cacheKey(MAIN_IMAGE, 'glsl', 'image', 'tools-b')).not.toBe(base);
  });
});

describe('shader pack manifest', () => {
  it('accepts the single-file shorthand', () => {
    expect(validateManifest({ name: 'Pack', language: 'glsl', surfaces: { background: 'bg.frag' } })).toBeNull();
    expect(normalizeSurface('bg.frag')).toEqual({
      passes: [{ name: null, kind: 'image', file: 'bg.frag', channels: [], dispatch: null, geometry: null, scale: 1 }],
      storage: 0,
    });
  });

  it('expands passes, channels and storage', () => {
    const surface = normalizeSurface({
      storage: 1024,
      passes: [
        { name: 'sim', type: 'compute', file: 'sim.comp', dispatch: [4, 1, 1] },
        { name: 'trail', file: 'trail.frag', channels: ['trail', 'sim'] },
        { file: 'image.frag', channels: [{ source: 'trail', filter: 'nearest' }, null, { source: 'tex/noise.png', wrap: 'repeat' }] },
      ],
    });
    expect(surface.storage).toBe(1024);
    expect(surface.passes.map(pass => pass.kind)).toEqual(['compute', 'buffer', 'image']);
    expect(surface.passes[0].dispatch).toEqual([4, 1, 1]);
    expect(surface.passes[1].channels).toEqual([
      { kind: 'pass', source: 'trail', filter: 'linear', wrap: 'clamp' },
      { kind: 'pass', source: 'sim', filter: 'linear', wrap: 'clamp' },
    ]);
    expect(surface.passes[2].channels).toEqual([
      { kind: 'pass', source: 'trail', filter: 'nearest', wrap: 'clamp' },
      null,
      { kind: 'image', source: 'tex/noise.png', filter: 'linear', wrap: 'repeat', flipY: true },
    ]);
  });

  it('rejects unknown languages, surfaces and paths outside the pack', () => {
    expect(validateManifest({ language: 'hlsl', surfaces: {} })).toMatch(/language/);
    expect(validateManifest({ language: 'glsl', surfaces: { timeline: 'a.frag' } })).toMatch(/unknown surface/);
    expect(validateManifest({ language: 'glsl', surfaces: { background: '../../evil.frag' } })).toMatch(/inside the pack/);
  });

  it('checks "constants" are named numbers', () => {
    const problem = (constants: unknown) => validateManifest({ language: 'glsl', surfaces: { background: 'bg.frag' }, constants });
    expect(problem({ GLOW: 0.5, _count: 3 })).toBeNull();
    expect(problem([1])).toMatch(/constants/);
    expect(problem({ '1st': 1 })).toMatch(/1st/);
    expect(problem({ gl_Thing: 1 })).toMatch(/gl_/);
    expect(problem({ halluSecret: 1 })).toMatch(/hallu/);
    expect(problem({ GLOW: '0.5' })).toMatch(/must be a number/);
    expect(problem({ GLOW: Infinity })).toMatch(/must be a number/);
  });

  it('turns constants into float defines, keeping error lines on the author\'s file', () => {
    expect(defineConstants('glsl', {})).toBe('');
    expect(defineConstants('glsl', { A: 1, B: 0.25 })).toBe('#define A 1.0\n#define B 0.25\n#line 1\n');
    expect(defineConstants('wgsl', { A: -2 })).toBe('const A : f32 = -2.0;\n');
  });

  it('accepts paintsPanelHeaders only as true or false', () => {
    const problem = (paintsPanelHeaders: unknown) => validateManifest({ language: 'glsl', surfaces: { background: 'bg.frag' }, paintsPanelHeaders });
    expect(problem(true)).toBeNull();
    expect(problem(false)).toBeNull();
    expect(problem(undefined)).toBeNull();
    expect(problem('yes')).toMatch(/paintsPanelHeaders/);
  });

  it('accepts PaintHalluMasterTitleBar only as true or false', () => {
    const problem = (PaintHalluMasterTitleBar: unknown) => validateManifest({ language: 'glsl', surfaces: { background: 'bg.frag' }, PaintHalluMasterTitleBar });
    expect(problem(true)).toBeNull();
    expect(problem(false)).toBeNull();
    expect(problem(undefined)).toBeNull();
    expect(problem(1)).toMatch(/PaintHalluMasterTitleBar/);
  });

  it('rejects broken pass lists', () => {
    const problem = (passes: unknown[], storage?: number) => validateManifest({ language: 'glsl', surfaces: { background: { passes, storage } } });
    expect(problem([])).toMatch(/non-empty/);
    expect(problem([{ file: 'a.frag' }, { file: 'b.frag' }])).toMatch(/needs a "name"/);
    expect(problem([{ name: 'a', file: 'a.frag' }, { name: 'a', file: 'b.frag' }, { file: 'c.frag' }])).toMatch(/two passes/);
    expect(problem([{ name: 'a', file: 'a.frag' }, { type: 'compute', file: 'b.comp' }])).toMatch(/last pass/);
    expect(problem([{ file: 'a.frag', channels: ['missing'] }])).toMatch(/neither a pass name nor an image/);
    expect(problem([{ file: 'a.frag', channels: ['a', 'b', 'c', 'd', 'e'] }])).toMatch(/up to 4/);
    expect(problem([{ file: 'a.frag', dispatch: [1, 1, 1] }])).toMatch(/dispatch/);
    expect(problem([{ file: 'a.frag' }], 3)).toMatch(/storage/);
  });

  it('scales fragment buffer passes, but not the last pass or other kinds', () => {
    const surface = normalizeSurface({ passes: [{ name: 'half', file: 'a.frag', scale: 0.5 }, { file: 'b.frag', channels: ['half'] }] });
    expect(surface.passes.map(pass => pass.scale)).toEqual([0.5, 1]);

    const problem = (passes: unknown[]) => validateManifest({ language: 'glsl', surfaces: { background: { passes } } });
    expect(problem([{ name: 'a', file: 'a.frag', scale: 0 }, { file: 'b.frag' }])).toMatch(/scale/);
    expect(problem([{ name: 'a', file: 'a.frag', scale: 1.5 }, { file: 'b.frag' }])).toMatch(/scale/);
    expect(problem([{ name: 'a', file: 'a.frag', scale: '0.5' }, { file: 'b.frag' }])).toMatch(/scale/);
    expect(problem([{ file: 'a.frag', scale: 0.5 }])).toMatch(/scale/);
    expect(problem([{ name: 'a', type: 'compute', file: 'a.comp', scale: 0.5 }, { file: 'b.frag' }])).toMatch(/scale/);
  });

  it('expands geometry passes with their vertex file and draw settings', () => {
    const surface = normalizeSurface({
      passes: [
        { name: 'rain', type: 'geometry', vertex: 'rain.vert', file: 'rain.frag', vertexCount: 6, instanceCount: 500, blend: 'add' },
        { name: 'cars', type: 'geometry', vertex: 'cars.vert', file: 'cars.frag', vertexCount: 36, depth: true },
        { file: 'image.frag', channels: ['rain', 'cars'] },
      ],
    });
    expect(surface.passes.map(pass => pass.kind)).toEqual(['geometry', 'geometry', 'image']);
    expect(surface.passes[0].geometry).toEqual({ vertexFile: 'rain.vert', vertexCount: 6, instanceCount: 500, blend: 'add', depth: false });
    expect(surface.passes[1].geometry).toEqual({ vertexFile: 'cars.vert', vertexCount: 36, instanceCount: 1, blend: 'replace', depth: true });
    expect(surface.passes[2].geometry).toBeNull();
  });

  it('rejects broken geometry passes', () => {
    const problem = (pass: object, language = 'glsl') => validateManifest({
      language,
      surfaces: { background: { passes: [{ name: 'g', type: 'geometry', file: 'g.frag', vertex: 'g.vert', vertexCount: 3, ...pass }, { file: 'a.frag' }] } },
    });
    expect(problem({})).toBeNull();
    expect(problem({ vertex: undefined })).toMatch(/"vertex" shader file/);
    expect(problem({ vertexCount: 0 })).toMatch(/"vertexCount"/);
    expect(problem({ instanceCount: 1.5 })).toMatch(/"instanceCount"/);
    expect(problem({ blend: 'multiply' })).toMatch(/"blend"/);
    expect(problem({ depth: 'yes' })).toMatch(/"depth"/);
    expect(problem({}, 'wgsl')).toMatch(/only supported in GLSL/);
    expect(validateManifest({ language: 'glsl', surfaces: { background: { passes: [{ name: 'a', file: 'a.frag', vertexCount: 3 }, { file: 'b.frag' }] } } }))
      .toMatch(/only applies to geometry passes/);
    expect(validateManifest({ language: 'glsl', surfaces: { background: { passes: [{ type: 'geometry', file: 'g.frag', vertex: 'g.vert', vertexCount: 3 }] } } }))
      .toMatch(/last pass/);
  });
});

describe.skipIf(!toolsInstalled)('glslang + tint translation', () => {
  it('turns a Shadertoy-style shader into WGSL', async () => {
    const result = await translateGlsl(MAIN_IMAGE);
    expect(result.ok).toBe(true);
    expect(result.wgsl).toContain('@fragment');
    expect(result.wgsl).toContain('var<uniform>');
  });

  it('reports errors on the author\'s own line numbers', async () => {
    const result = await translateGlsl('void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n  fragColor = missing;\n}\n');
    expect(result.ok).toBe(false);
    expect(result.stage).toBe('glslang');
    expect(result.errors[0]).toMatchObject({ line: 2 });
  });

  it('splits iChannel samplers into the texture and sampler bindings the renderer expects', async () => {
    const source = [
      'vec4 tap(sampler2D s, vec2 uv) { return texture(s, uv); }',
      'void mainImage(out vec4 fragColor, in vec2 fragCoord) {',
      '  vec2 uv = fragCoord / iChannelResolution[3].xy;',
      '  fragColor = tap(iChannel0, uv) + texelFetch(iChannel3, ivec2(fragCoord), 0);',
      '}',
    ].join('\n');
    const result = await translateGlsl(source, 'buffer');
    expect(result.ok).toBe(true);
    expect(result.wgsl).toMatch(/@binding\(1u?\) var \w+ : texture_2d<f32>/);
    expect(result.wgsl).toMatch(/@binding\(2u?\) var \w+ : sampler/);
    expect(result.wgsl).toMatch(/@binding\(7u?\) var \w+ : texture_2d<f32>/);
  });

  it('exposes the theme colors as iTheme', async () => {
    const source = 'void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n  fragColor = mix(iTheme.bgBase, iTheme.automationLine, 0.5);\n}\n';
    const result = await translateGlsl(source);
    expect(result.ok).toBe(true);
    expect(wrapWgsl('fn mainImage(fragCoord : vec2f) -> vec4f { return hallu.iTheme.highlightColor; }')).toContain('iTheme : HalluTheme');
  });

  it('lets packs find panels by kind and stacking order', async () => {
    const source = [
      'void mainImage(out vec4 fragColor, in vec2 fragCoord) {',
      '  fragColor = vec4(0.0);',
      '  for (int i = 0; i < iPanelCount; i++) {',
      '    if (iPanelInfo[i].x == 2 && iPanelInfo[i].y == 0) fragColor = vec4(iPanels[i].xy, 0.0, 1.0);',
      '  }',
      '}',
    ].join('\n');
    const result = await translateGlsl(source);
    expect(result.ok).toBe(true);
    expect(result.wgsl).toMatch(/iPanelInfo\s*:\s*array<vec4<i32>, 16u?>/);
  });

  it('translates compute passes with storage buffers, atomics and shared memory', async () => {
    const source = [
      'HALLU_STORAGE Counters { uint alive; float values[]; };',
      'shared float tile[64];',
      'layout(local_size_x = 8, local_size_y = 8) in;',
      'void main() {',
      '  ivec2 id = ivec2(gl_GlobalInvocationID.xy);',
      '  tile[gl_LocalInvocationIndex] = texture(iChannel0, vec2(id) / iResolution.xy).r;',
      '  barrier();',
      '  atomicAdd(alive, 1u);',
      '  imageStore(iOutput, id, vec4(tile[0], values[0], 0.0, 1.0));',
      '}',
    ].join('\n');
    const result = await translateGlsl(source, 'compute');
    expect(result.ok).toBe(true);
    expect(parseWorkgroupSize(result.wgsl)).toEqual([8, 8, 1]);
    expect(result.wgsl).toMatch(/@binding\(9u?\) var iOutput : texture_storage_2d<rgba32float, write>/);
    expect(result.wgsl).toMatch(/@binding\(10u?\) var<storage, read_write>/);
  });

  it('translates geometry passes: a vertex stage and a fragment stage sharing varyings and read-only storage', async () => {
    const storage = 'HALLU_STORAGE Points { vec4 points[]; };\n';
    const vertex = await translateGlsl(`${storage}layout(location = 0) out vec4 vColor;
vec4 mainVertex(int vertexIndex, int instanceIndex) {
  vColor = points[instanceIndex] * iTheme.border;
  return vec4(float(vertexIndex) * 0.1, textureLod(iChannel0, vec2(0.5), 0.0).r, 0.5, 1.0);
}
`, 'vertex');
    const fragment = await translateGlsl(`${storage}layout(location = 0) in vec4 vColor;
void mainImage(out vec4 fragColor, in vec2 fragCoord) { fragColor = vColor + points[0]; }
`, 'geometry');
    expect(vertex.ok && fragment.ok).toBe(true);
    expect(vertex.wgsl).toContain('@vertex');
    expect(fragment.wgsl).toMatch(/@location\(0u?\) vColor/);
    for (const wgsl of [vertex.wgsl, fragment.wgsl]) expect(wgsl).toMatch(/@binding\(10u?\) var<storage, read>/);
  }, 30000);
});
