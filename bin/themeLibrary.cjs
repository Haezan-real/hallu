// themeLibrary.cjs
// Themes live in user/themes as JSON files; folders become folders in the Themes modal.
//   { "name": "cyberpunk", "colors": { "--bg-panel": "#0D0221", ... } }
// A theme's id is its path without ".json" ("default/cyberpunk"); "name" is its label and
// defaults to the file name. Missing colors fall back to the default theme in the renderer.
// A file with the same name replaces the theme's generated preview tile:
//   cyberpunk.frag                                  a GLSL mainImage shader, animated
//   cyberpunk.png / .jpg / .jpeg / .webp / .gif     an image, animated if the file is
// When several exist the shader wins, then the first image in that list.
const fs = require('fs');
const path = require('path');
const { THEME_VARS } = require('./themeVars.cjs');
const { hasEntryPoint, translateGlslCached } = require('./shaderPacks.cjs');

const THEMES_DIR = path.join(__dirname, '..', 'user', 'themes');
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

// Picks the icon file for a theme from the other files in its folder (names compared case-insensitively)
function findIcon(baseName, fileNames) {
  const byName = new Map(fileNames.map(name => [name.toLowerCase(), name]));
  const extensions = [SHADER_ICON_EXTENSION, ...IMAGE_ICON_EXTENSIONS];
  for (const extension of extensions) {
    const match = byName.get(`${baseName}${extension}`.toLowerCase());
    if (match) return { kind: extension === SHADER_ICON_EXTENSION ? 'shader' : 'image', fileName: match };
  }
  return null;
}

const byLabel = (a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
const toId = (rootDir, fullPath) => path.relative(rootDir, fullPath).split(path.sep).join('/');

/**
 * Scans the themes folder into { topLevel, items, problems }: items maps ids to folders
 * ({ type: 'folder', children }) and themes ({ type: 'theme', colors, icon }), each with a parent.
 * icon is { kind: 'shader' | 'image', file, version } or null; version changes when the file does.
 * Broken theme files are skipped and listed in problems.
 */
function readThemeLibrary(rootDir = THEMES_DIR) {
  const items = {};
  const problems = [];

  const scan = (dir, parent) => {
    const folders = [];
    const themes = [];
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const fileNames = entries.filter(entry => entry.isFile()).map(entry => entry.name);
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const id = toId(rootDir, fullPath);
        folders.push({ id, label: entry.name, type: 'folder', parent, children: scan(fullPath, id) });
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
        const id = toId(rootDir, fullPath).slice(0, -'.json'.length);
        const baseName = entry.name.slice(0, -'.json'.length);
        try {
          const theme = validateTheme(JSON.parse(fs.readFileSync(fullPath, 'utf8')), baseName);
          const found = findIcon(baseName, fileNames);
          const icon = found && {
            kind: found.kind,
            file: toId(rootDir, path.join(dir, found.fileName)),
            version: fs.statSync(path.join(dir, found.fileName)).mtimeMs,
          };
          themes.push({ id, label: theme.name, type: 'theme', parent, colors: theme.colors, icon });
        } catch (err) {
          problems.push({ file: `themes/${toId(rootDir, fullPath)}`, message: err.message });
        }
      }
    }
    folders.sort(byLabel);
    themes.sort(byLabel);
    for (const item of [...folders, ...themes]) items[item.id] = item;
    return [...folders, ...themes].map(item => item.id);
  };

  const topLevel = scan(rootDir, null);
  return { topLevel, items, problems };
}

// Resolves an icon path from the renderer, refusing anything outside the themes folder
function resolveIconPath(file, extensions, rootDir = THEMES_DIR) {
  if (typeof file !== 'string') throw new Error('invalid icon path');
  const fullPath = path.resolve(rootDir, file);
  if (!fullPath.startsWith(rootDir + path.sep)) throw new Error(`"${file}" is not inside the themes folder`);
  if (!extensions.includes(path.extname(fullPath).toLowerCase())) throw new Error(`"${file}" is not a theme icon`);
  return fullPath;
}

function readIconImage(file, rootDir = THEMES_DIR) {
  return fs.readFileSync(resolveIconPath(file, IMAGE_ICON_EXTENSIONS, rootDir));
}

// Shader icons are single GLSL mainImage files, compiled like a shader pack's screen pass
async function compileIconShader(file, rootDir = THEMES_DIR) {
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

// Editing, adding or removing anything under user/themes tells the renderer to reload
function watchThemeLibrary(onChange, rootDir = THEMES_DIR) {
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

function registerThemeHandlers(ipcMain, getWindow) {
  ipcMain.handle('themes-load', () => readThemeLibrary());
  ipcMain.handle('themes-icon-image', (_event, file) => readIconImage(file));
  ipcMain.handle('themes-icon-shader', (_event, file) => compileIconShader(file));
  return watchThemeLibrary(() => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('themes-changed');
  });
}

module.exports = {
  THEME_VARS,
  validateTheme,
  findIcon,
  readThemeLibrary,
  readIconImage,
  compileIconShader,
  registerThemeHandlers,
};
