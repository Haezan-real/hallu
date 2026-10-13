// main.cjs
const path = require('path');
const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const config = require('./config.json');
const iconConfig = require('./src/config/appIcon.json');
const { roundIconCorners } = require('./iconRounding.cjs');
const { registerSettingsStorageHandlers } = require('./settingsStorage.cjs');



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

// Radius comes from src/config/appIcon.json and scales with the icon size.
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
// Temporarily default-on for diagnosis; set DRAG_DIAG=false to silence.
const DIAG = process.env.DRAG_DIAG !== 'false';
const DEV_SERVER_URL = 'http://localhost:5173';
const APP_ENTRY = path.join(__dirname, '..', 'dist', 'index.html');

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
    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.dragStartWidth = null;
    this.dragStartHeight = null;
    this.ready = false;

    // Drag diagnostics: per-second counters + a live timer while dragging
    this.diag = {
      dragMoveIpc: 0,   // window-drag-move IPCs received
      setPosition: 0,   // native setPosition calls on appWindow
      setPosMs: 0,      // total ms spent inside setPosition (blocking time)
      setPosMaxMs: 0,   // worst single setPosition latency
    };
    this.diagTimer = null;
  }

  diagLogTick() {
    const d = this.diag;
    console.log(
      `[DRAG-DIAG] dragIpc=${d.dragMoveIpc}/s setPos=${d.setPosition}/s ` +
      `setPosTime=${d.setPosMs.toFixed(1)}ms/s max=${d.setPosMaxMs.toFixed(1)}ms`
    );
    for (const k of Object.keys(d)) d[k] = 0;
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
    const isAppWindowSender = (event) => this.appWindow && !this.appWindow.isDestroyed() && event.sender === this.appWindow.webContents;
    const isValidScreenPosition = (position) => position && Number.isFinite(position.x) && Number.isFinite(position.y);

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

    // Manual window dragging (bypasses OS cursor override bug)
    ipcMain.on('window-drag-start', (event, position) => {
      if (!isAppWindowSender(event) || !isValidScreenPosition(position) || this.appWindow.isMaximized()) return;
      const bounds = this.appWindow.getBounds();
      this.isDragging = true;
      this.dragOffsetX = position.x - bounds.x;
      this.dragOffsetY = position.y - bounds.y;
      this.dragStartWidth = bounds.width;
      this.dragStartHeight = bounds.height;
      if (DIAG && !this.diagTimer) {
        this.diagTimer = setInterval(() => this.diagLogTick(), 1000);
      }
    });

    ipcMain.on('window-drag-move', (event, position) => {
      if (!isAppWindowSender(event) || !this.isDragging || !isValidScreenPosition(position)) return;
      if (DIAG) this.diag.dragMoveIpc++;
      const t0 = DIAG ? performance.now() : 0;
      // setBounds with the full rect (not bare setPosition) prevents the
      // Windows frameless-window quirk where setPosition drifts the height
      // and fires ~50 spurious resize events/sec mid-drag, each forcing a
      // full Chromium re-layout of the renderer.
      this.appWindow.setBounds({
        x: Math.round(position.x - this.dragOffsetX),
        y: Math.round(position.y - this.dragOffsetY),
        width: this.dragStartWidth,
        height: this.dragStartHeight,
      });
      if (DIAG) {
        this.diag.setPosition++;
        const dt = performance.now() - t0;
        this.diag.setPosMs += dt;
        if (dt > this.diag.setPosMaxMs) this.diag.setPosMaxMs = dt;
      }
    });

    ipcMain.on('window-drag-end', (event) => {
      if (!isAppWindowSender(event)) return;
      this.isDragging = false;
      this.dragStartWidth = null;
      this.dragStartHeight = null;
      if (this.diagTimer) { clearInterval(this.diagTimer); this.diagTimer = null; }
    });

    registerSettingsStorageHandlers();

    console.log('✅ IPC handlers registered');
  }

  // ── Window Lifecycle Cleanup ─────────────────────────────────────────────

  setupLifecycleHandlers() {
    this.appWindow?.on('closed', () => {
      this.isDragging = false;
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

    // 2. IPC handlers (window controls, dragging, settings storage)
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
