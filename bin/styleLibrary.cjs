// styleLibrary.cjs
// Styles live in user/styles; folders become folders in the Styles modal. A style is either
//   a theme file   forest.json, colors only, with an optional same-name icon (forest.png, forest.frag, ...)
//   a shader pack  a folder with manifest.json (see shaderPacks.cjs) and its shaders, plus
//                  theme.json for its colors and an optional icon.png / icon.frag / ...
// Theme files and theme.json:  { "name": "forest", "colors": { "--bg-panel": "#1A332A", ... } }
// A style's id is its path: "default/forest" for a theme file (without ".json"), "cyberpunk" for
// a pack folder. Theme file labels come from "name" or the file name; pack labels from the
// manifest's "name" or the folder name. Colors a style leaves out fall back to the default style
// in the renderer, and a pack without theme.json gets one written with the default style's colors.
// Icons: a .frag (a GLSL mainImage shader, animated) wins over images, checked in the order
// .png .jpg .jpeg .webp .gif (animated if the file is). Without one, the modal draws a preview.
const fs = require('fs');
const path = require('path');
const { THEME_VARS } = require('./themeVars.cjs');
const { hasEntryPoint, isPackId, translateGlslCached, validateManifest } = require('./shaderPacks.cjs');

const STYLES_DIR = path.join(__dirname, '..', 'user', 'styles');
const DEFAULT_THEME_FILE = 'default/og-dark.json';
const MANIFEST_FILE = 'manifest.json';
const PACK_THEME_FILE = 'theme.json';
const PACK_ICON_NAME = 'icon';
const WATCH_DEBOUNCE_MS = 150;
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const SHADER_ICON_EXTENSION = '.frag';
const IMAGE_ICON_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

// Returns { name, colors } or throws with a message for the theme author
function validateTheme(theme, fallbackName) {
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) throw new Error('must contain an object');
  if (theme.name !== undefined && (typeof theme.name !== 'string' || !theme.name.trim())) throw new Error('"name" must be text');
  if (!theme.colors || typeof theme.colors !== 'object' || Array.isArray(theme.colors)) {
    throw new Error('"colors" must map color names like "--bg-panel" to hex colors');
  }
  const colors = {};
  for (const [varName, value] of Object.entries(theme.colors)) {
    if (!THEME_VARS.includes(varName)) throw new Error(`unknown color "${varName}" (expected one of: ${THEME_VARS.join(', ')})`);
    if (typeof value !== 'string' || !HEX_COLOR.test(value)) throw new Error(`"${varName}" must be a hex color like #1a2b3c`);
    colors[varName] = value;
  }
  return { name: theme.name?.trim() || fallbackName, colors };
}

// Picks the icon file named baseName from the files in a folder (names compared case-insensitively)
function findIcon(baseName, fileNames) {
  const byName = new Map(fileNames.map(name => [name.toLowerCase(), name]));
  for (const extension of [SHADER_ICON_EXTENSION, ...IMAGE_ICON_EXTENSIONS]) {
    const match = byName.get(`${baseName}${extension}`.toLowerCase());
    if (match) return { kind: extension === SHADER_ICON_EXTENSION ? 'shader' : 'image', fileName: match };
  }
  return null;
}

const byLabel = (a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
const toId = (rootDir, fullPath) => path.relative(rootDir, fullPath).split(path.sep).join('/');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

// icon is { kind: 'shader' | 'image', file, version }; version changes whenever the file does
function iconInfo(rootDir, dir, found) {
  if (!found) return null;
  const fullPath = path.join(dir, found.fileName);
  return { kind: found.kind, file: toId(rootDir, fullPath), version: fs.statSync(fullPath).mtimeMs };
}

function readDefaultColors(rootDir) {
  try {
    return validateTheme(readJson(path.join(rootDir, DEFAULT_THEME_FILE)), '').colors;
  } catch {
    return null;
  }
}

// A pack without theme.json gets one with the default colors, giving its author a file to edit
function readPackColors(packDir, rootDir) {
  const themePath = path.join(packDir, PACK_THEME_FILE);
  if (!fs.existsSync(themePath)) {
    const colors = readDefaultColors(rootDir) ?? {};
    try {
      fs.writeFileSync(themePath, `${JSON.stringify({ colors }, null, 2)}\n`, 'utf8');
    } catch (err) {
      console.warn(`Could not create ${toId(rootDir, themePath)}: ${err.message}`);
    }
    return colors;
  }
  try {
    return validateTheme(readJson(themePath), '').colors;
  } catch (err) {
    throw new Error(`${PACK_THEME_FILE}: ${err.message}`);
  }
}

function readPack(rootDir, dir, id, parent, fileNames) {
  if (!isPackId(id)) throw new Error('pack folder names may only use letters, digits, spaces, "_", "." and "-"');
  let manifest;
  try {
    manifest = readJson(path.join(dir, MANIFEST_FILE));
  } catch (err) {
    throw new Error(`${MANIFEST_FILE}: ${err.message}`);
  }
  const problem = validateManifest(manifest);
  if (problem) throw new Error(`${MANIFEST_FILE}: ${problem}`);
  const label = typeof manifest.name === 'string' && manifest.name.trim() ? manifest.name.trim() : path.basename(dir);
  const colors = readPackColors(dir, rootDir);
  const icon = iconInfo(rootDir, dir, findIcon(PACK_ICON_NAME, fileNames));
  return { id, label, type: 'style', parent, colors, icon, shader: id };
}

function readThemeFile(rootDir, dir, fileName, parent, fileNames) {
  const fullPath = path.join(dir, fileName);
  const baseName = fileName.slice(0, -'.json'.length);
  const theme = validateTheme(readJson(fullPath), baseName);
  const id = toId(rootDir, fullPath).slice(0, -'.json'.length);
  const icon = iconInfo(rootDir, dir, findIcon(baseName, fileNames));
  return { id, label: theme.name, type: 'style', parent, colors: theme.colors, icon, shader: null };
}

const listFolder = dir => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter(entry => !entry.name.startsWith('.'));
  } catch {
    return [];
  }
};
const fileNamesOf = entries => entries.filter(entry => entry.isFile()).map(entry => entry.name);

/**
 * Scans the styles folder into { topLevel, items, problems }: items maps ids to folders
 * ({ type: 'folder', children }) and styles ({ type: 'style', colors, icon, shader }), each with
 * a parent. shader is the style's pack id, or null for colors-only styles.
 * Broken styles are skipped and listed in problems.
 */
function readStyleLibrary(rootDir = STYLES_DIR) {
  const items = {};
  const problems = [];
  const skip = (fullPath, err) => problems.push({ file: `styles/${toId(rootDir, fullPath)}`, message: err.message });

  const scan = (dir, parent) => {
    const entries = listFolder(dir);
    const fileNames = fileNamesOf(entries);
    const folders = [];
    const styles = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const id = toId(rootDir, fullPath);
      if (entry.isDirectory()) {
        const children = listFolder(fullPath);
        if (children.some(child => child.isFile() && child.name.toLowerCase() === MANIFEST_FILE)) {
          try {
            styles.push(readPack(rootDir, fullPath, id, parent, fileNamesOf(children)));
          } catch (err) {
            skip(fullPath, err);
          }
        } else {
          folders.push({ id, label: entry.name, type: 'folder', parent, children: scan(fullPath, id) });
        }
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
        try {
          styles.push(readThemeFile(rootDir, dir, entry.name, parent, fileNames));
        } catch (err) {
          skip(fullPath, err);
        }
      }
    }
    folders.sort(byLabel);
    styles.sort(byLabel);
    for (const item of [...folders, ...styles]) items[item.id] = item;
    return [...folders, ...styles].map(item => item.id);
  };

  const topLevel = scan(rootDir, null);
  return { topLevel, items, problems };
}

// Resolves an icon path from the renderer, refusing anything outside the styles folder
function resolveIconPath(file, extensions, rootDir) {
  if (typeof file !== 'string') throw new Error('invalid icon path');
  const fullPath = path.resolve(rootDir, file);
  if (!fullPath.startsWith(rootDir + path.sep)) throw new Error(`"${file}" is not inside the styles folder`);
  if (!extensions.includes(path.extname(fullPath).toLowerCase())) throw new Error(`"${file}" is not a style icon`);
  return fullPath;
}

function readIconImage(file, rootDir = STYLES_DIR) {
  return fs.readFileSync(resolveIconPath(file, IMAGE_ICON_EXTENSIONS, rootDir));
}

// Shader icons are single GLSL mainImage files, compiled like a shader pack's screen pass
async function compileIconShader(file, rootDir = STYLES_DIR) {
  let source;
  try {
    source = fs.readFileSync(resolveIconPath(file, [SHADER_ICON_EXTENSION], rootDir), 'utf8');
  } catch (err) {
    return { ok: false, errors: [{ line: null, message: err.code === 'ENOENT' ? 'file not found' : err.message }] };
  }
  if (!hasEntryPoint(source, 'glsl', 'image')) {
    return { ok: false, errors: [{ line: null, message: 'missing void mainImage(out vec4 fragColor, in vec2 fragCoord)' }] };
  }
  const result = await translateGlslCached(source, 'image');
  return result.ok ? { ok: true, wgsl: result.wgsl } : { ok: false, errors: result.errors };
}

// Editing, adding or removing anything under user/styles tells the renderer to reload
function watchStyleLibrary(onChange, rootDir = STYLES_DIR) {
  if (!fs.existsSync(rootDir)) return () => {};
  let timer = null;
  const watcher = fs.watch(rootDir, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, WATCH_DEBOUNCE_MS);
  });
  return () => {
    clearTimeout(timer);
    watcher.close();
  };
}

function registerStyleHandlers(ipcMain, getWindow) {
  ipcMain.handle('styles-load', () => readStyleLibrary());
  ipcMain.handle('styles-icon-image', (_event, file) => readIconImage(file));
  ipcMain.handle('styles-icon-shader', (_event, file) => compileIconShader(file));
  return watchStyleLibrary(() => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('styles-changed');
  });
}

module.exports = {
  THEME_VARS,
  validateTheme,
  findIcon,
  readStyleLibrary,
  readIconImage,
  compileIconShader,
  registerStyleHandlers,
};
