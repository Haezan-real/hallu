// shaderPacks.cjs
// Shader packs live in user/shaders/<pack>/ with a manifest.json. Pack authors write
// Shadertoy-style code; Hallu adds the boilerplate, then translates
//   GLSL 4.60 --glslang--> SPIR-V --tint--> WGSL
// and caches the WGSL by content hash so unchanged shaders skip translation.
//
// manifest.json:
//   { "name": "...", "language": "glsl" | "wgsl", "surfaces": { "background": <surface> } }
// A surface is either one mainImage file ("background": "image.frag") or a list of passes
// that run in order every frame, the last one drawing to the screen:
//   { "storage": 1048576,                    optional storage buffer in bytes, shared by all passes
//     "passes": [
//       { "name": "bufferA", "file": "a.frag", "channels": ["bufferA", "noise.png"] },
//       { "name": "sim", "type": "compute", "file": "sim.comp", "dispatch": [64, 1, 1] },
//       { "file": "image.frag", "channels": ["bufferA", { "source": "sim", "filter": "nearest" }] } ] }
// channels fill iChannel0-3. A channel names a pass (reading a pass that hasn't run yet this
// frame, including itself, gives its previous frame) or an image in the pack. Object form adds
// "filter": "linear" | "nearest", "wrap": "clamp" | "repeat" and, for images, "flipY" (default true).
// Compute passes write their output with imageStore(iOutput, ...); texels they skip keep last
// frame's value. Without "dispatch" they run one invocation per pixel.
// iTheme holds the active theme's colors as vec4s (iTheme.bgBase, iTheme.border, ...; in WGSL
// hallu.iTheme.bgBase), exactly matching the UI and fading along with theme transitions.
const { execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { THEME_VARS } = require('./themeLibrary.cjs');

const SHADERS_DIR = path.join(__dirname, '..', 'user', 'shaders');
const CACHE_DIR = path.join(__dirname, '..', 'user', '.cache', 'shaders');
const TOOLS_DIR = path.join(__dirname, 'tools', 'shader');
const GLSLANG = path.join(TOOLS_DIR, 'glslang.exe');
const TINT = path.join(TOOLS_DIR, 'tint.exe');

// Bump whenever the boilerplate or the translation flags change, so cached WGSL is rebuilt
const BOILERPLATE_VERSION = 3;
const LANGUAGES = ['glsl', 'wgsl'];
const SURFACES = ['background'];
const PASS_TYPES = ['fragment', 'compute'];
const PASS_NAME = /^[A-Za-z_][\w-]*$/;
const MAX_CHANNELS = 4;
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif'];
const MAX_STORAGE_BYTES = 1024 ** 3;
const TOOL_TIMEOUT_MS = 20000;
const WATCH_DEBOUNCE_MS = 150;

// The active theme's colors, in the order the renderer fills them in.
// "--bg-base" becomes iTheme.bgBase, and so on.
const THEME_FIELDS = THEME_VARS.map(varName => varName.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()));

// Shadertoy-compatible inputs plus iTheme, mirrored by the renderer's uniform buffer (std140, 400 bytes).
// Tint splits each sampler2D into a texture at its binding and a sampler at the next one.
const GLSL_HEADER = `#version 460
struct HalluTheme {
${THEME_FIELDS.map(field => `  vec4 ${field};`).join('\n')}
};
layout(set = 0, binding = 0, std140) uniform HalluGlobals {
  vec3 iResolution;
  float iTime;
  vec4 iMouse;
  float iTimeDelta;
  int iFrame;
  float iFrameRate;
  float halluPad0;
  vec4 iDate;
  vec3 iChannelResolution[4];
  HalluTheme iTheme;
};
layout(set = 0, binding = 1) uniform sampler2D iChannel0;
layout(set = 0, binding = 3) uniform sampler2D iChannel1;
layout(set = 0, binding = 5) uniform sampler2D iChannel2;
layout(set = 0, binding = 7) uniform sampler2D iChannel3;
#define HALLU_STORAGE layout(std430, set = 0, binding = 10) buffer
`;

const GLSL_PRELUDES = {
  image: `${GLSL_HEADER}layout(location = 0) out vec4 halluFragColor;\n#line 1\n`,
  buffer: `${GLSL_HEADER}layout(location = 0) out vec4 halluFragColor;\n#line 1\n`,
  compute: `${GLSL_HEADER}layout(set = 0, binding = 9, rgba32f) uniform writeonly image2D iOutput;\n#line 1\n`,
};

// Buffers are stored bottom row first, so fragCoord, texelFetch and texture() uv all agree.
// Only the screen pass flips, putting (0,0) at the bottom-left as on Shadertoy.
const GLSL_EPILOGUES = {
  image: `
void main() {
  vec4 color = vec4(0.0);
  mainImage(color, vec2(gl_FragCoord.x, iResolution.y - gl_FragCoord.y));
  halluFragColor = vec4(color.rgb, 1.0);
}
`,
  buffer: `
void main() {
  vec4 color = vec4(0.0);
  mainImage(color, gl_FragCoord.xy);
  halluFragColor = color;
}
`,
  compute: '',
};

const WGSL_HEADER = `struct HalluTheme {
${THEME_FIELDS.map(field => `  ${field} : vec4f,`).join('\n')}
}
struct HalluGlobals {
  iResolution : vec3f,
  iTime : f32,
  iMouse : vec4f,
  iTimeDelta : f32,
  iFrame : i32,
  iFrameRate : f32,
  halluPad0 : f32,
  iDate : vec4f,
  iChannelResolution : array<vec3f, 4>,
  iTheme : HalluTheme,
}
@group(0) @binding(0) var<uniform> hallu : HalluGlobals;
@group(0) @binding(1) var iChannel0 : texture_2d<f32>;
@group(0) @binding(2) var iChannel0Sampler : sampler;
@group(0) @binding(3) var iChannel1 : texture_2d<f32>;
@group(0) @binding(4) var iChannel1Sampler : sampler;
@group(0) @binding(5) var iChannel2 : texture_2d<f32>;
@group(0) @binding(6) var iChannel2Sampler : sampler;
@group(0) @binding(7) var iChannel3 : texture_2d<f32>;
@group(0) @binding(8) var iChannel3Sampler : sampler;
`;

const WGSL_PRELUDES = {
  image: WGSL_HEADER,
  buffer: WGSL_HEADER,
  compute: `${WGSL_HEADER}@group(0) @binding(9) var iOutput : texture_storage_2d<rgba32float, write>;\n`,
};

const WGSL_EPILOGUES = {
  image: `
@fragment
fn main(@builtin(position) position : vec4f) -> @location(0) vec4f {
  let color = mainImage(vec2f(position.x, hallu.iResolution.y - position.y));
  return vec4f(color.rgb, 1.0);
}
`,
  buffer: `
@fragment
fn main(@builtin(position) position : vec4f) -> @location(0) vec4f {
  return mainImage(position.xy);
}
`,
  compute: '',
};

// WGSL has no #line directive, so the renderer subtracts this from compiler line numbers
function wgslPreludeLines(kind) {
  return WGSL_PRELUDES[kind].split('\n').length - 1;
}

function wrapGlsl(source, kind = 'image') {
  return GLSL_PRELUDES[kind] + source + GLSL_EPILOGUES[kind];
}

function wrapWgsl(source, kind = 'image') {
  return WGSL_PRELUDES[kind] + source + WGSL_EPILOGUES[kind];
}

function hasEntryPoint(source, language, kind) {
  if (kind === 'compute') return language === 'wgsl' ? /\bfn\s+main\s*\(/.test(source) : /\bvoid\s+main\s*\(/.test(source);
  return language === 'wgsl' ? /\bfn\s+mainImage\s*\(/.test(source) : /\bvoid\s+mainImage\s*\(/.test(source);
}

function entryPointSignature(language, kind) {
  if (kind === 'compute') return language === 'wgsl' ? '@compute @workgroup_size(...) fn main(...)' : 'layout(local_size_x = ...) in; void main()';
  return language === 'wgsl' ? 'fn mainImage(fragCoord : vec2f) -> vec4f' : 'void mainImage(out vec4 fragColor, in vec2 fragCoord)';
}

// The renderer binds the storage buffer read-write; a read-only declaration would fail pipeline validation
function allowStorageWrites(wgsl) {
  return wgsl.replace(/(@binding\(\s*10u?\s*\)\s*var<\s*storage\s*,\s*)read(\s*>)/g, '$1read_write$2');
}

// "@compute @workgroup_size(8u, 8u, 1u)" -> [8, 8, 1]; null when the size isn't a literal
function parseWorkgroupSize(wgsl) {
  const match = wgsl.match(/@workgroup_size\s*\(([^)]*)\)/);
  if (!match) return null;
  const parts = match[1].split(',').map(part => part.trim()).filter(Boolean);
  const size = [1, 1, 1];
  for (let i = 0; i < parts.length && i < 3; i++) {
    const value = Number.parseInt(parts[i].replace(/[iu]$/, ''), 10);
    if (!Number.isInteger(value) || value < 1 || String(value) !== parts[i].replace(/[iu]$/, '')) return null;
    size[i] = value;
  }
  return size;
}

// "ERROR: C:\...\shader.frag:6: 'undefinedThing' : undeclared identifier"
function parseGlslangErrors(output) {
  const errors = [];
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trim();
    const match = line.match(/^ERROR:\s+.*?:(\d+):\s*(.*)$/);
    if (match) {
      const message = match[2].replace(/^''\s*:\s*/, '').trim();
      if (message !== 'compilation terminated') errors.push({ line: Number(match[1]), message });
    } else if (/^ERROR:/.test(line) && !/compilation errors|Missing entry point|SPIR-V is not generated/.test(line)) {
      errors.push({ line: null, message: line.replace(/^ERROR:\s*/, '') });
    }
  }
  return errors;
}

// Tint prints "error: ..." plus "note: ..." lines, followed by an IR dump that is not useful to pack authors
function parseTintErrors(output) {
  const errors = [];
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trim();
    const error = line.match(/^(?:.*?:\d+:\d+\s+)?error:\s*(.*)$/);
    const note = line.match(/^(?:.*?:\d+:\d+\s+)?note:\s*(.*)$/);
    if (error) errors.push({ line: null, message: explainTintError(error[1]) });
    else if (note && errors.length > 0) errors[errors.length - 1].message += ` (${note[1]})`;
  }
  return errors.length > 0 ? errors : [{ line: null, message: output.trim().split(/\r?\n/)[0] || 'Unknown translation error' }];
}

// Rephrases the WebGPU restrictions pack authors are most likely to hit
function explainTintError(message) {
  if (/\bf64\b|Float64|double/i.test(message)) return `double precision isn't supported in Hallu shaders, use float. (${message})`;
  if (/\bi64\b|u64\b|Int64/i.test(message)) return `64-bit integers aren't supported in Hallu shaders. (${message})`;
  if (/Geometry|Tessellation/i.test(message)) return `geometry and tessellation shaders aren't supported by WebGPU. (${message})`;
  return message;
}

function readToolVersions() {
  try {
    return fs.readFileSync(path.join(TOOLS_DIR, 'versions.json'), 'utf8');
  } catch {
    return '';
  }
}

function cacheKey(source, language, kind, toolVersions = readToolVersions()) {
  return crypto.createHash('sha256')
    .update(`hallu-shader:${BOILERPLATE_VERSION}\n${language}\n${kind}\n${toolVersions}\n`)
    .update(source)
    .digest('hex');
}

function isPackPath(file) {
  return typeof file === 'string' && file.length > 0 && !path.isAbsolute(file) && !file.split(/[\\/]/).includes('..');
}

function isImagePath(file) {
  return isPackPath(file) && IMAGE_EXTENSIONS.includes(path.extname(file).toLowerCase());
}

function normalizeChannel(channel, label, passNames) {
  if (channel === null) return null;
  const spec = typeof channel === 'string' ? { source: channel } : channel;
  if (!spec || typeof spec !== 'object' || typeof spec.source !== 'string') {
    throw new Error(`${label} must be a pass name, an image file or { "source": ... }`);
  }
  const filter = spec.filter ?? 'linear';
  const wrap = spec.wrap ?? 'clamp';
  if (filter !== 'linear' && filter !== 'nearest') throw new Error(`${label} "filter" must be "linear" or "nearest"`);
  if (wrap !== 'clamp' && wrap !== 'repeat') throw new Error(`${label} "wrap" must be "clamp" or "repeat"`);
  if (passNames.has(spec.source)) return { kind: 'pass', source: spec.source, filter, wrap };
  if (!isImagePath(spec.source)) {
    throw new Error(`${label} "${spec.source}" is neither a pass name nor an image in the pack (${IMAGE_EXTENSIONS.join(', ')})`);
  }
  const flipY = spec.flipY ?? true;
  if (typeof flipY !== 'boolean') throw new Error(`${label} "flipY" must be true or false`);
  return { kind: 'image', source: spec.source, filter, wrap, flipY };
}

// Expands the single-file shorthand and checks every pass; throws with a message for the pack author
function normalizeSurface(surface) {
  const spec = typeof surface === 'string' ? { passes: [{ file: surface }] } : surface;
  if (!spec || typeof spec !== 'object' || !Array.isArray(spec.passes) || spec.passes.length === 0) {
    throw new Error('must name a shader file or contain a non-empty "passes" list');
  }
  const last = spec.passes.length - 1;
  const passNames = new Set();
  spec.passes.forEach((pass, index) => {
    if (!pass || typeof pass !== 'object') throw new Error(`pass ${index + 1} must be an object`);
    if (index === last) return;
    if (typeof pass.name !== 'string' || !PASS_NAME.test(pass.name)) {
      throw new Error(`pass ${index + 1} needs a "name" (letters, digits, _ or -) so other passes can read it`);
    }
    if (passNames.has(pass.name)) throw new Error(`two passes are named "${pass.name}"`);
    passNames.add(pass.name);
  });

  const passes = spec.passes.map((pass, index) => {
    const label = `pass ${index + 1}`;
    if (!isPackPath(pass.file)) throw new Error(`${label} must name a "file" inside the pack`);
    const type = pass.type ?? 'fragment';
    if (!PASS_TYPES.includes(type)) throw new Error(`${label} "type" must be one of: ${PASS_TYPES.join(', ')}`);
    if (index === last && type !== 'fragment') throw new Error('the last pass draws to the screen, so it must be a fragment pass');
    const channels = pass.channels ?? [];
    if (!Array.isArray(channels) || channels.length > MAX_CHANNELS) {
      throw new Error(`${label} "channels" must be a list of up to ${MAX_CHANNELS} inputs`);
    }
    let dispatch = null;
    if (pass.dispatch !== undefined) {
      const valid = Array.isArray(pass.dispatch) && pass.dispatch.length === 3 && pass.dispatch.every(n => Number.isInteger(n) && n >= 1);
      if (type !== 'compute' || !valid) throw new Error(`${label} "dispatch" must be [x, y, z] workgroup counts on a compute pass`);
      dispatch = pass.dispatch;
    }
    return {
      name: index === last ? null : pass.name,
      kind: type === 'compute' ? 'compute' : index === last ? 'image' : 'buffer',
      file: pass.file,
      channels: channels.map((channel, slot) => normalizeChannel(channel, `${label} channel ${slot}`, passNames)),
      dispatch,
    };
  });

  const storage = spec.storage ?? 0;
  if (!Number.isInteger(storage) || storage < 0 || storage % 4 !== 0 || storage > MAX_STORAGE_BYTES) {
    throw new Error(`"storage" must be a byte count that is a multiple of 4, at most ${MAX_STORAGE_BYTES}`);
  }
  return { passes, storage };
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') return 'manifest.json must contain an object';
  if (!LANGUAGES.includes(manifest.language)) return `"language" must be one of: ${LANGUAGES.join(', ')}`;
  if (!manifest.surfaces || typeof manifest.surfaces !== 'object') return '"surfaces" must map surface names to shaders';
  for (const [surface, spec] of Object.entries(manifest.surfaces)) {
    if (!SURFACES.includes(surface)) return `unknown surface "${surface}" (supported: ${SURFACES.join(', ')})`;
    try {
      normalizeSurface(spec);
    } catch (err) {
      return `surface "${surface}": ${err.message}`;
    }
  }
  return null;
}

function readManifest(packId) {
  const manifestPath = path.join(SHADERS_DIR, packId, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const problem = validateManifest(manifest);
  if (problem) throw new Error(`${packId}/manifest.json: ${problem}`);
  return manifest;
}

function listShaderPacks() {
  if (!fs.existsSync(SHADERS_DIR)) return [];
  const packs = [];
  for (const entry of fs.readdirSync(SHADERS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || !fs.existsSync(path.join(SHADERS_DIR, entry.name, 'manifest.json'))) continue;
    try {
      const manifest = readManifest(entry.name);
      packs.push({ id: entry.name, name: typeof manifest.name === 'string' ? manifest.name : entry.name, language: manifest.language });
    } catch (err) {
      console.error(`❌ Skipping shader pack "${entry.name}": ${err.message}`);
    }
  }
  return packs;
}

function runTool(executable, args) {
  return new Promise(resolve => {
    execFile(executable, args, { timeout: TOOL_TIMEOUT_MS, windowsHide: true }, (error, stdout, stderr) => {
      resolve({ ok: !error, output: `${stdout}\n${stderr}` });
    });
  });
}

async function translateGlsl(source, kind = 'image') {
  if (!fs.existsSync(GLSLANG) || !fs.existsSync(TINT)) {
    return { ok: false, stage: 'setup', errors: [{ line: null, message: 'Shader tools are not installed. Run "npm run tools:shaders" in bin/.' }] };
  }
  const stage = kind === 'compute' ? 'comp' : 'frag';
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hallu-shader-'));
  try {
    const glslPath = path.join(workDir, `shader.${stage}`);
    const spvPath = path.join(workDir, 'shader.spv');
    const wgslPath = path.join(workDir, 'shader.wgsl');
    fs.writeFileSync(glslPath, wrapGlsl(source, kind));

    const glslang = await runTool(GLSLANG, ['-V', '--target-env', 'vulkan1.1', '-S', stage, '-o', spvPath, glslPath]);
    if (!glslang.ok) return { ok: false, stage: 'glslang', errors: parseGlslangErrors(glslang.output) };

    // Shadertoy code often takes derivatives inside branches, which WGSL rejects by default
    const tint = await runTool(TINT, ['--format', 'wgsl', '--allow-non-uniform-derivatives', 'true', '-o', wgslPath, spvPath]);
    if (!tint.ok) return { ok: false, stage: 'tint', errors: parseTintErrors(tint.output) };

    return { ok: true, wgsl: fs.readFileSync(wgslPath, 'utf8') };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

/**
 * Returns WGSL for one pass. lineOffset is how many boilerplate lines precede the author's
 * WGSL; it is null for GLSL, whose translated line numbers don't match the author's file.
 */
async function compilePass(packId, language, pass) {
  const file = `${packId}/${pass.file}`;
  let source;
  try {
    source = fs.readFileSync(path.join(SHADERS_DIR, packId, pass.file), 'utf8');
  } catch {
    return { ok: false, file, stage: 'manifest', errors: [{ line: null, message: 'file not found' }] };
  }
  if (!hasEntryPoint(source, language, pass.kind)) {
    return { ok: false, file, stage: 'source', errors: [{ line: null, message: `missing ${entryPointSignature(language, pass.kind)}` }] };
  }

  if (language === 'wgsl') {
    return { ok: true, file, wgsl: wrapWgsl(source, pass.kind), lineOffset: wgslPreludeLines(pass.kind), cached: false };
  }

  const cachePath = path.join(CACHE_DIR, `${cacheKey(source, language, pass.kind)}.wgsl`);
  if (fs.existsSync(cachePath)) {
    return { ok: true, file, wgsl: fs.readFileSync(cachePath, 'utf8'), lineOffset: null, cached: true };
  }

  const result = await translateGlsl(source, pass.kind);
  if (!result.ok) return { ...result, file };
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachePath, result.wgsl, 'utf8');
  return { ok: true, file, wgsl: result.wgsl, lineOffset: null, cached: false };
}

/** Compiles every pass of one surface of a pack, or returns the first error that stopped it. */
async function compileSurface(packId, surface) {
  const manifestFile = `${packId}/manifest.json`;
  let manifest;
  try {
    manifest = readManifest(packId);
  } catch (err) {
    return { ok: false, file: manifestFile, stage: 'manifest', errors: [{ line: null, message: err.message }] };
  }
  if (!manifest.surfaces[surface]) {
    return { ok: false, file: manifestFile, stage: 'manifest', errors: [{ line: null, message: `no "${surface}" surface` }] };
  }

  const { passes, storage } = normalizeSurface(manifest.surfaces[surface]);
  const compiled = await Promise.all(passes.map(pass => compilePass(packId, manifest.language, pass)));
  const failed = compiled.find(result => !result.ok);
  if (failed) return failed;

  return {
    ok: true,
    storage,
    cached: compiled.every(result => result.cached),
    passes: passes.map((pass, index) => ({
      ...pass,
      file: compiled[index].file,
      wgsl: allowStorageWrites(compiled[index].wgsl),
      lineOffset: compiled[index].lineOffset,
      workgroupSize: pass.kind === 'compute' ? parseWorkgroupSize(compiled[index].wgsl) : null,
    })),
  };
}

// Images used as channels, read on request so the renderer never touches the filesystem
function readPackAsset(packId, file) {
  if (!isImagePath(file)) throw new Error(`"${file}" is not an image inside the pack`);
  const packDir = path.join(SHADERS_DIR, packId);
  const fullPath = path.resolve(packDir, file);
  if (!fullPath.startsWith(packDir + path.sep)) throw new Error(`"${file}" is not inside the pack`);
  return fs.readFileSync(fullPath);
}

// Editing any file under user/shaders tells the renderer to recompile the active pack
function watchShaderPacks(onChange) {
  if (!fs.existsSync(SHADERS_DIR)) return () => {};
  let timer = null;
  const watcher = fs.watch(SHADERS_DIR, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, WATCH_DEBOUNCE_MS);
  });
  return () => {
    clearTimeout(timer);
    watcher.close();
  };
}

function isPackId(packId) {
  return typeof packId === 'string' && /^[\w .-]+$/.test(packId) && packId !== '.' && packId !== '..';
}

function registerShaderPackHandlers(ipcMain, getWindow) {
  ipcMain.handle('shader-packs-list', () => listShaderPacks());
  ipcMain.handle('shader-packs-compile', (_event, packId, surface) => {
    if (!isPackId(packId) || typeof surface !== 'string') {
      return { ok: false, file: String(packId), stage: 'manifest', errors: [{ line: null, message: 'invalid shader pack id' }] };
    }
    return compileSurface(packId, surface);
  });
  ipcMain.handle('shader-packs-asset', (_event, packId, file) => {
    if (!isPackId(packId)) throw new Error('invalid shader pack id');
    return readPackAsset(packId, file);
  });
  return watchShaderPacks(() => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('shader-packs-changed');
  });
}

module.exports = {
  wrapGlsl,
  wrapWgsl,
  wgslPreludeLines,
  hasEntryPoint,
  allowStorageWrites,
  parseWorkgroupSize,
  parseGlslangErrors,
  parseTintErrors,
  cacheKey,
  normalizeSurface,
  validateManifest,
  translateGlsl,
  listShaderPacks,
  compileSurface,
  registerShaderPackHandlers,
  THEME_FIELDS,
};
