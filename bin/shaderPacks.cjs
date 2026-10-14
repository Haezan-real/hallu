// shaderPacks.cjs
// Shader packs live in user/shaders/<pack>/ with a manifest.json. Pack authors write
// Shadertoy-style mainImage() code; Hallu adds the boilerplate, then translates
//   GLSL 4.60 --glslang--> SPIR-V --tint--> WGSL
// and caches the WGSL by content hash so unchanged shaders skip translation.
const { execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SHADERS_DIR = path.join(__dirname, '..', 'user', 'shaders');
const CACHE_DIR = path.join(__dirname, '..', 'user', '.cache', 'shaders');
const TOOLS_DIR = path.join(__dirname, 'tools', 'shader');
const GLSLANG = path.join(TOOLS_DIR, 'glslang.exe');
const TINT = path.join(TOOLS_DIR, 'tint.exe');

// Bump whenever the boilerplate or the translation flags change, so cached WGSL is rebuilt
const BOILERPLATE_VERSION = 1;
const LANGUAGES = ['glsl', 'wgsl'];
const SURFACES = ['background'];
const TOOL_TIMEOUT_MS = 20000;
const WATCH_DEBOUNCE_MS = 150;

// Shadertoy-compatible inputs. std140 layout: 64 bytes, mirrored by the renderer's uniform buffer.
const GLSL_PRELUDE = `#version 460
layout(set = 0, binding = 0, std140) uniform HalluGlobals {
  vec3 iResolution;
  float iTime;
  vec4 iMouse;
  float iTimeDelta;
  int iFrame;
  float iFrameRate;
  float halluPad0;
  vec4 iDate;
};
layout(location = 0) out vec4 halluFragColor;
#line 1
`;

// fragCoord is flipped so (0,0) is bottom-left, as on Shadertoy
const GLSL_EPILOGUE = `
void main() {
  vec4 color = vec4(0.0);
  mainImage(color, vec2(gl_FragCoord.x, iResolution.y - gl_FragCoord.y));
  halluFragColor = vec4(color.rgb, 1.0);
}
`;

const WGSL_PRELUDE = `struct HalluGlobals {
  iResolution : vec3f,
  iTime : f32,
  iMouse : vec4f,
  iTimeDelta : f32,
  iFrame : i32,
  iFrameRate : f32,
  halluPad0 : f32,
  iDate : vec4f,
}
@group(0) @binding(0) var<uniform> hallu : HalluGlobals;
`;

const WGSL_EPILOGUE = `
@fragment
fn main(@builtin(position) position : vec4f) -> @location(0) vec4f {
  let color = mainImage(vec2f(position.x, hallu.iResolution.y - position.y));
  return vec4f(color.rgb, 1.0);
}
`;

// WGSL has no #line directive, so the renderer subtracts this from compiler line numbers
const WGSL_PRELUDE_LINES = WGSL_PRELUDE.split('\n').length - 1;

function wrapGlsl(source) {
  return GLSL_PRELUDE + source + GLSL_EPILOGUE;
}

function wrapWgsl(source) {
  return WGSL_PRELUDE + source + WGSL_EPILOGUE;
}

function hasMainImage(source, language) {
  return language === 'wgsl' ? /\bfn\s+mainImage\s*\(/.test(source) : /\bvoid\s+mainImage\s*\(/.test(source);
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

function cacheKey(source, language, toolVersions = readToolVersions()) {
  return crypto.createHash('sha256')
    .update(`hallu-shader:${BOILERPLATE_VERSION}\n${language}\n${toolVersions}\n`)
    .update(source)
    .digest('hex');
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') return 'manifest.json must contain an object';
  if (!LANGUAGES.includes(manifest.language)) return `"language" must be one of: ${LANGUAGES.join(', ')}`;
  if (!manifest.surfaces || typeof manifest.surfaces !== 'object') return '"surfaces" must map surface names to shader files';
  for (const [surface, file] of Object.entries(manifest.surfaces)) {
    if (!SURFACES.includes(surface)) return `unknown surface "${surface}" (supported: ${SURFACES.join(', ')})`;
    if (typeof file !== 'string' || file.includes('..') || path.isAbsolute(file)) return `surface "${surface}" must name a file inside the pack`;
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

async function translateGlsl(source) {
  if (!fs.existsSync(GLSLANG) || !fs.existsSync(TINT)) {
    return { ok: false, stage: 'setup', errors: [{ line: null, message: 'Shader tools are not installed. Run "npm run tools:shaders" in bin/.' }] };
  }
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hallu-shader-'));
  try {
    const glslPath = path.join(workDir, 'shader.frag');
    const spvPath = path.join(workDir, 'shader.spv');
    const wgslPath = path.join(workDir, 'shader.wgsl');
    fs.writeFileSync(glslPath, wrapGlsl(source));

    const glslang = await runTool(GLSLANG, ['-V', '--target-env', 'vulkan1.1', '-S', 'frag', '-o', spvPath, glslPath]);
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
 * Returns WGSL for one surface of a pack, or the errors that stopped it.
 * lineOffset tells the renderer how many boilerplate lines precede the author's code.
 */
async function compileSurface(packId, surface) {
  let manifest;
  try {
    manifest = readManifest(packId);
  } catch (err) {
    return { ok: false, file: `${packId}/manifest.json`, stage: 'manifest', errors: [{ line: null, message: err.message }] };
  }
  const fileName = manifest.surfaces[surface];
  if (!fileName) return { ok: false, file: `${packId}/manifest.json`, stage: 'manifest', errors: [{ line: null, message: `no "${surface}" surface` }] };

  const file = `${packId}/${fileName}`;
  let source;
  try {
    source = fs.readFileSync(path.join(SHADERS_DIR, packId, fileName), 'utf8');
  } catch {
    return { ok: false, file, stage: 'manifest', errors: [{ line: null, message: 'file not found' }] };
  }
  if (!hasMainImage(source, manifest.language)) {
    const signature = manifest.language === 'wgsl' ? 'fn mainImage(fragCoord : vec2f) -> vec4f' : 'void mainImage(out vec4 fragColor, in vec2 fragCoord)';
    return { ok: false, file, stage: 'source', errors: [{ line: null, message: `missing ${signature}` }] };
  }

  if (manifest.language === 'wgsl') {
    return { ok: true, file, wgsl: wrapWgsl(source), lineOffset: WGSL_PRELUDE_LINES, cached: false };
  }

  const key = cacheKey(source, manifest.language);
  const cachePath = path.join(CACHE_DIR, `${key}.wgsl`);
  if (fs.existsSync(cachePath)) {
    return { ok: true, file, wgsl: fs.readFileSync(cachePath, 'utf8'), lineOffset: 0, cached: true };
  }

  const result = await translateGlsl(source);
  if (!result.ok) return { ...result, file };
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachePath, result.wgsl, 'utf8');
  return { ok: true, file, wgsl: result.wgsl, lineOffset: 0, cached: false };
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

function registerShaderPackHandlers(ipcMain, getWindow) {
  ipcMain.handle('shader-packs-list', () => listShaderPacks());
  ipcMain.handle('shader-packs-compile', (_event, packId, surface) => {
    if (typeof packId !== 'string' || typeof surface !== 'string' || !/^[\w .-]+$/.test(packId)) {
      return { ok: false, file: String(packId), stage: 'manifest', errors: [{ line: null, message: 'invalid shader pack id' }] };
    }
    return compileSurface(packId, surface);
  });
  return watchShaderPacks(() => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('shader-packs-changed');
  });
}

module.exports = {
  wrapGlsl,
  wrapWgsl,
  hasMainImage,
  parseGlslangErrors,
  parseTintErrors,
  cacheKey,
  validateManifest,
  translateGlsl,
  listShaderPacks,
  compileSurface,
  registerShaderPackHandlers,
  WGSL_PRELUDE_LINES,
};
