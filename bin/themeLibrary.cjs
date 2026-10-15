// themeLibrary.cjs
// Themes live in user/themes as JSON files; folders become folders in the Themes modal.
//   { "name": "cyberpunk", "colors": { "--bg-panel": "#0D0221", ... } }
// A theme's id is its path without ".json" ("default/cyberpunk"); "name" is its label and
// defaults to the file name. Missing colors fall back to the default theme in the renderer.
const fs = require('fs');
const path = require('path');

const THEMES_DIR = path.join(__dirname, '..', 'user', 'themes');
const WATCH_DEBOUNCE_MS = 150;
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

// The theme colors, in the order of src/modals/themes/colorFields.ts
const THEME_VARS = [
  '--bg-panel', '--bg-base', '--bg-viewer', '--video-bg', '--bg-elevated', '--bg-hover',
  '--border', '--border-mid', '--splitter', '--text-primary', '--text-secondary', '--text-muted',
  '--input-field', '--input-field-bg', '--playneedle', '--highlight-color', '--automation-line',
];

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

const byLabel = (a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });

/**
 * Scans the themes folder into { topLevel, items, problems }: items maps ids to folders
 * ({ type: 'folder', children }) and themes ({ type: 'theme', colors }), each with a parent.
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
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const relative = path.relative(rootDir, path.join(dir, entry.name)).split(path.sep).join('/');
      if (entry.isDirectory()) {
        const children = scan(path.join(dir, entry.name), relative);
        folders.push({ id: relative, label: entry.name, type: 'folder', parent, children });
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
        const id = relative.slice(0, -'.json'.length);
        try {
          const theme = validateTheme(JSON.parse(fs.readFileSync(path.join(dir, entry.name), 'utf8')), path.basename(id));
          themes.push({ id, label: theme.name, type: 'theme', parent, colors: theme.colors });
        } catch (err) {
          problems.push({ file: `themes/${relative}`, message: err.message });
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
  return watchThemeLibrary(() => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('themes-changed');
  });
}

module.exports = {
  THEME_VARS,
  validateTheme,
  readThemeLibrary,
  registerThemeHandlers,
};
