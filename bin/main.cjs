// main.cjs
const path = require('path');
const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const config = require('./config.json');
const iconConfig = require('./appIcon.json');
const { roundIconCorners } = require('./iconRounding.cjs');
const { registerSettingsStorageHandlers } = require('./settingsStorage.cjs');
const { registerShaderPackHandlers } = require('./shaderPacks.cjs');
const { registerStyleHandlers } = require('./styleLibrary.cjs');



// ─── Constants ───────────────────────────────────────────────────────────────
const WINDOW_DEFAULTS = { width: 1280, height: 800 };
const WIN_PRELOAD = path.join(__dirname, 'preload.cjs');
const ICON_DIR = path.join(__dirname, '..', 'assets', 'icons', 'app');
const DAY_START_HOUR = 7;
const NIGHT_START_HOUR = 19;
const ICON_CHECK_INTERVAL_MS = 60 * 1000;
const TASKBAR_ICON_SIZE_PX = 256;
const roundedIconCache = new Map();

function isNightTime(date = new Date()) {
  const hour = date.getHours();
  return hour >= NIGHT_START_HOUR || hour < DAY_START_HOUR;
}

// Radius comes from bin/appIcon.json and scales with the icon size.
function getRoundedIcon(variant) {
  if (roundedIconCache.has(variant)) return roundedIconCache.get(variant);

  const source = nativeImage.createFromPath(path.join(ICON_DIR, `hallu_${variant}.png`));
  let icon = path.join(ICON_DIR, `hallu_${variant}.ico`);
  if (!source.isEmpty()) {
    const size = TASKBAR_ICON_SIZE_PX;
    const radius = (iconConfig.cornerRadiusPx * size) / iconConfig.baseSizePx;
    const resized = source.resize({ width: size, height: size, quality: 'best' });
    icon = nativeImage.createFromBitmap(roundIconCorners(resized.toBitmap(), size, radius), { width: size, height: size });
  }
  roundedIconCache.set(variant, icon);
  return icon;
}

function getWindowIcon() {
  return getRoundedIcon(isNightTime() ? 'night' : 'day');
}

// Re-checks the clock periodically so the taskbar icon flips at 7am/7pm
// while the app is running (and after the PC wakes from sleep).
function startIconScheduler() {
  let currentIcon = getWindowIcon();
  setInterval(() => {
    const nextIcon = getWindowIcon();
    if (nextIcon === currentIcon) return;
    currentIcon = nextIcon;
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.setIcon(nextIcon);
    }
  }, ICON_CHECK_INTERVAL_MS);
}
const MAXIMIZE_DELAY_MS = 1;
const IS_DEVELOPMENT = process.env.ELECTRON_DEV === 'true';
const DEV_SERVER_URL = 'http://localhost:5173';
const APP_ENTRY = path.join(__dirname, '..', 'dist', 'index.html');

// Launched as `electron main.cjs` the app has no name and would share the generic
// AppData/Electron profile, whose locked caches stop Chromium persisting compiled GPU shaders
app.setPath('userData', path.join(app.getPath('appData'), 'Hallu'));

// On laptops with two GPUs Chromium runs the UI and WebGPU on the integrated one and ignores
// requestAdapter's powerPreference on Windows, so shaders would never reach the discrete GPU
app.commandLine.appendSwitch('force-high-performance-gpu');

// ─── Config validation with defaults ─────────────────────────────────────────
function loadConfig() {
  return {
    downscaleFactor: config.DOWNSCALE_FACTOR ?? 1,
    enshittify: config.enshittify ?? false,
    slideshow: config.slideshow ?? false,
  };
}

// ─── Shared webPreferences for all windows ───────────────────────────────────
const WEB_PREFERENCES = {
  preload: WIN_PRELOAD,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false,
};

// ─── Window Manager ──────────────────────────────────────────────────────────
class WindowManager {
  constructor() {
    this.cfg = loadConfig();
    this.appWindow = null;
    this.ready = false;
  }

  loadWindow(window, developmentPath, productionPath) {
    if (IS_DEVELOPMENT) {
      return window.loadURL(`${DEV_SERVER_URL}/${developmentPath}`.replace(/\/$/, ''));
    }
    return window.loadFile(productionPath);
  }

  // ── Window Creation ──────────────────────────────────────────────────────

  createAppWindow() {
    // Create at default size; maximize after the delay once loaded
    this.appWindow = new BrowserWindow({
      ...WINDOW_DEFAULTS,
      frame: false,
      skipTaskbar: false,
      opacity: 1,
      icon: getWindowIcon(),
      webPreferences: WEB_PREFERENCES,
    });
    this.loadWindow(this.appWindow, '', APP_ENTRY);

    // The header is a native drag region; suppress the Windows system menu
    // that right-clicking it would open, matching the app's no-context-menu UI.
    this.appWindow.on('system-context-menu', (event) => event.preventDefault());

    // Maximize after the delay once the window finishes loading
    this.appWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        if (this.appWindow && !this.appWindow.isDestroyed()) {
          this.appWindow.maximize();
          console.log(`✅ app_window maximized after ${MAXIMIZE_DELAY_MS}ms delay`);
        }
      }, MAXIMIZE_DELAY_MS);
    });

    console.log(`✅ app_window created (regular size, will maximize after ${MAXIMIZE_DELAY_MS}ms)`);
    return this.appWindow;
  }

  // ── IPC Handlers ─────────────────────────────────────────────────────────

  setupIPCHandlers() {
    // Window controls
    ipcMain.on('window-minimize', () => this.appWindow.minimize());
    ipcMain.on('window-maximize', () => {
      if (this.appWindow.isMaximized()) {
        this.appWindow.unmaximize();
      } else {
        this.appWindow.maximize();
      }
    });
    ipcMain.on('window-fullscreen', () => {
      if (this.appWindow.isFullScreen()) {
        this.appWindow.setFullScreen(false);
      } else {
        this.appWindow.setFullScreen(true);
      }
    });
    ipcMain.on('window-close', () => this.appWindow.close());

    registerSettingsStorageHandlers();
    registerShaderPackHandlers(ipcMain);
    registerStyleHandlers(ipcMain, () => this.appWindow);

    console.log('✅ IPC handlers registered');
  }

  // ── Window Lifecycle Cleanup ─────────────────────────────────────────────

  setupLifecycleHandlers() {
    this.appWindow?.on('closed', () => {
      this.appWindow = null;
    });
  }

  // ── Initialization ───────────────────────────────────────────────────────

  async init() {
    console.log('main.cjs — WindowManager initializing');

    // 1. Create the app window
    this.createAppWindow();

    this.appWindow.webContents.on('did-finish-load', () => {
      console.log('🔧 Main window loaded');
    });

    // 2. IPC handlers (window controls, settings storage)
    this.setupIPCHandlers();

    // 3. Window lifecycle cleanup
    this.setupLifecycleHandlers();

    this.ready = true;
    console.log('✅ WindowManager initialized successfully');
  }
}

// ─── Application Entry Point ─────────────────────────────────────────────────
app.whenReady().then(async () => {
  console.log('main.cjs invoked');
  const manager = new WindowManager();
  await manager.init();
  startIconScheduler();
});
