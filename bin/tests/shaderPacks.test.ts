import { existsSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  cacheKey,
  hasMainImage,
  parseGlslangErrors,
  parseTintErrors,
  translateGlsl,
  validateManifest,
  wrapGlsl,
  wrapWgsl,
  WGSL_PRELUDE_LINES,
} from '../shaderPacks.cjs';

const MAIN_IMAGE = 'void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n  fragColor = vec4(fragCoord / iResolution.xy, 0.5 + 0.5 * sin(iTime), 1.0);\n}\n';
const toolsInstalled = existsSync(join(__dirname, '..', 'tools', 'shader', 'tint.exe'));

describe('shader boilerplate', () => {
  it('resets line numbers so errors point at the author\'s file', () => {
    const wrapped = wrapGlsl(MAIN_IMAGE);
    expect(wrapped.startsWith('#version 460')).toBe(true);
    expect(wrapped).toContain(`#line 1\n${MAIN_IMAGE}`);
    expect(wrapped).toContain('mainImage(color, vec2(gl_FragCoord.x, iResolution.y - gl_FragCoord.y))');
  });

  it('reports how many WGSL boilerplate lines precede the author\'s code', () => {
    const source = 'fn mainImage(fragCoord : vec2f) -> vec4f { return vec4f(1.0); }';
    const lines = wrapWgsl(source).split('\n');
    expect(lines[WGSL_PRELUDE_LINES]).toBe(source);
  });

  it('detects the mainImage entry point per language', () => {
    expect(hasMainImage(MAIN_IMAGE, 'glsl')).toBe(true);
    expect(hasMainImage('void main() {}', 'glsl')).toBe(false);
    expect(hasMainImage('fn mainImage(fragCoord : vec2f) -> vec4f {}', 'wgsl')).toBe(true);
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
  it('changes when the source or the tool versions change', () => {
    const base = cacheKey(MAIN_IMAGE, 'glsl', 'tools-a');
    expect(cacheKey(MAIN_IMAGE, 'glsl', 'tools-a')).toBe(base);
    expect(cacheKey(`${MAIN_IMAGE} `, 'glsl', 'tools-a')).not.toBe(base);
    expect(cacheKey(MAIN_IMAGE, 'glsl', 'tools-b')).not.toBe(base);
  });
});

describe('shader pack manifest', () => {
  it('accepts a valid manifest', () => {
    expect(validateManifest({ name: 'Pack', language: 'glsl', surfaces: { background: 'bg.frag' } })).toBeNull();
  });

  it('rejects unknown languages, surfaces and paths outside the pack', () => {
    expect(validateManifest({ language: 'hlsl', surfaces: {} })).toMatch(/language/);
    expect(validateManifest({ language: 'glsl', surfaces: { timeline: 'a.frag' } })).toMatch(/unknown surface/);
    expect(validateManifest({ language: 'glsl', surfaces: { background: '../../evil.frag' } })).toMatch(/inside the pack/);
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
});
