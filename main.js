// PictureWall — Electron main process.
// Owns the app state, the photo-folder watcher, and both windows.
const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { SCENE_DEFS } = require('./src/shared/scene-defs');

const PHOTO_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif', '.jfif']);
const AUDIO_FILTER = {
  name: 'Music files',
  extensions: ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'webm'],
};

let controlWin = null;
let displayWin = null;
let displayReady = false;
let pendingTransport = null;

// ---------------------------------------------------------------- state ----

function defaultState() {
  return {
    photoFolder: null,
    playlist: [], // [{ path, name }]
    currentTrack: 0,
    sceneId: 'classic',
    sceneSettings: {}, // { [sceneId]: { [key]: value } }
    settings: {
      minSwitchSec: 4,
      maxSwitchSec: 10,
      beatSensitivity: 50,
      prioritizeNew: true,
      fitPhotos: false,
      volume: 80,
      loopPlaylist: true,
      shufflePlaylist: false,
    },
  };
}

let state = defaultState();

function settingsFile() {
  return path.join(app.getPath('userData'), 'picturewall-settings.json');
}

function loadState() {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    const def = defaultState();
    state = {
      ...def,
      ...raw,
      settings: { ...def.settings, ...(raw.settings || {}) },
      sceneSettings: raw.sceneSettings || {},
    };
    if (state.photoFolder && !fs.existsSync(state.photoFolder)) state.photoFolder = null;
    if (!SCENE_DEFS.some((d) => d.id === state.sceneId)) state.sceneId = 'classic';
    state.playlist = (state.playlist || []).filter((t) => t && t.path && fs.existsSync(t.path));
    if (state.currentTrack >= state.playlist.length) state.currentTrack = 0;
  } catch {
    state = defaultState();
  }
}

let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
      fs.writeFileSync(settingsFile(), JSON.stringify(state, null, 2));
    } catch {
      /* non-fatal */
    }
  }, 400);
}

function broadcast(channel, payload) {
  for (const w of [controlWin, displayWin]) {
    if (w && !w.isDestroyed()) w.webContents.send(channel, payload);
  }
}

function pushState() {
  broadcast('state:update', state);
  saveState();
}

// ------------------------------------------------------- photo watching ----

let photos = []; // [{ path, mtime }]
let pendingSizes = new Map(); // freshly-written files we wait on until their size is stable
let pollTimer = null;
let watcher = null;
let watchDebounce = null;
let scanning = false;

async function listPhotoFiles(dir, depth = 0) {
  let out = [];
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (depth < 3) out = out.concat(await listPhotoFiles(full, depth + 1));
    } else if (PHOTO_EXTS.has(path.extname(e.name).toLowerCase())) {
      try {
        const st = await fsp.stat(full);
        out.push({ path: full, mtime: st.mtimeMs, size: st.size });
      } catch {
        /* file vanished mid-scan */
      }
    }
  }
  return out;
}

async function scanPhotos() {
  if (!state.photoFolder || scanning) return;
  scanning = true;
  try {
    const found = await listPhotoFiles(state.photoFolder);
    const foundMap = new Map(found.map((f) => [f.path, f]));
    const known = new Map(photos.map((p) => [p.path, p]));
    const added = [];
    const nextPending = new Map();

    for (const f of found) {
      if (known.has(f.path)) continue;
      // A file modified moments ago may still be copying; wait until its size
      // is stable across two scans before showing it.
      const fresh = Date.now() - f.mtime < 10000;
      if (!fresh || pendingSizes.get(f.path) === f.size) {
        known.set(f.path, { path: f.path, mtime: f.mtime });
        added.push(f.path);
      } else {
        nextPending.set(f.path, f.size);
      }
    }

    let removed = false;
    for (const p of [...known.keys()]) {
      if (!foundMap.has(p)) {
        known.delete(p);
        removed = true;
      }
    }
    pendingSizes = nextPending;

    if (added.length || removed) {
      photos = [...known.values()].sort((a, b) => a.mtime - b.mtime);
      broadcast('photos:update', { photos, added });
    }
  } finally {
    scanning = false;
  }
}

function stopWatching() {
  if (watcher) {
    try { watcher.close(); } catch { /* already closed */ }
    watcher = null;
  }
  clearInterval(pollTimer);
  pollTimer = null;
}

function startWatching() {
  stopWatching();
  if (!state.photoFolder) return;
  try {
    watcher = fs.watch(state.photoFolder, { recursive: true }, () => {
      clearTimeout(watchDebounce);
      watchDebounce = setTimeout(scanPhotos, 400);
    });
    watcher.on('error', () => { /* polling still covers us */ });
  } catch {
    /* recursive watch unsupported — polling still covers us */
  }
  pollTimer = setInterval(scanPhotos, 2500);
  scanPhotos();
}

function setPhotoFolder(folder) {
  state.photoFolder = folder;
  photos = [];
  pendingSizes = new Map();
  broadcast('photos:update', { photos: [], added: [] });
  startWatching();
  pushState();
}

// -------------------------------------------------------------- windows ----

function createControlWindow() {
  controlWin = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 920,
    minHeight: 640,
    backgroundColor: '#14151d',
    title: 'PictureWall',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  controlWin.setMenuBarVisibility(false);
  controlWin.loadFile(path.join(__dirname, 'src', 'control', 'control.html'));
  controlWin.on('closed', () => {
    controlWin = null;
    app.quit();
  });
}

function createDisplayWindow() {
  if (displayWin && !displayWin.isDestroyed()) {
    displayWin.focus();
    return;
  }
  displayReady = false;
  const primary = screen.getPrimaryDisplay();
  const external = screen.getAllDisplays().find((d) => d.id !== primary.id);
  const opts = {
    width: 1280,
    height: 720,
    backgroundColor: '#000000',
    show: false,
    title: 'PictureWall — Show',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  };
  if (external) {
    opts.x = external.bounds.x + 40;
    opts.y = external.bounds.y + 40;
  }
  displayWin = new BrowserWindow(opts);
  displayWin.setMenuBarVisibility(false);
  displayWin.loadFile(path.join(__dirname, 'src', 'display', 'display.html'));
  displayWin.once('ready-to-show', () => {
    if (!displayWin || displayWin.isDestroyed()) return;
    if (external) displayWin.setFullScreen(true);
    else displayWin.maximize();
    displayWin.show();
  });
  displayWin.on('closed', () => {
    displayWin = null;
    displayReady = false;
    pendingTransport = null;
    if (controlWin && !controlWin.isDestroyed()) {
      controlWin.webContents.send('display:open-changed', { open: false });
      controlWin.webContents.send('status:update', {
        playing: false,
        trackIndex: state.currentTrack,
        trackName: null,
        position: 0,
        duration: 0,
      });
    }
  });
  if (controlWin && !controlWin.isDestroyed()) {
    controlWin.webContents.send('display:open-changed', { open: true });
  }
}

function sendTransport(cmd) {
  if (displayWin && !displayWin.isDestroyed() && displayReady) {
    displayWin.webContents.send('transport', cmd);
  } else {
    pendingTransport = cmd;
  }
}

function toggleDisplayFullscreen() {
  if (displayWin && !displayWin.isDestroyed()) {
    displayWin.setFullScreen(!displayWin.isFullScreen());
  }
}

// ------------------------------------------------------------ media IPC ----

function isAllowedMedia(p) {
  if (typeof p !== 'string' || !p) return false;
  const rp = path.resolve(p);
  if (state.playlist.some((t) => path.resolve(t.path) === rp)) return true;
  if (state.photoFolder) {
    const rel = path.relative(path.resolve(state.photoFolder), rp);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return true;
  }
  return false;
}

// ------------------------------------------------------------------ IPC ----

function registerIpc() {
  ipcMain.handle('app:get-state', () => ({
    state,
    photos,
    displayOpen: !!(displayWin && !displayWin.isDestroyed()),
  }));

  ipcMain.handle('dialog:choose-folder', async () => {
    const r = await dialog.showOpenDialog(controlWin, {
      title: 'Choose your photo folder',
      properties: ['openDirectory'],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    setPhotoFolder(r.filePaths[0]);
    return r.filePaths[0];
  });

  ipcMain.handle('dialog:add-music', async () => {
    const r = await dialog.showOpenDialog(controlWin, {
      title: 'Add music',
      properties: ['openFile', 'multiSelections'],
      filters: [AUDIO_FILTER],
    });
    if (!r.canceled) {
      for (const p of r.filePaths) {
        if (!state.playlist.some((t) => t.path === p)) {
          state.playlist.push({ path: p, name: path.basename(p) });
        }
      }
      pushState();
    }
    return state.playlist;
  });

  ipcMain.handle('media:read', async (_e, filePath) => {
    if (!isAllowedMedia(filePath)) throw new Error('Access denied');
    return fsp.readFile(filePath);
  });

  ipcMain.on('control:set-settings', (_e, partial) => {
    if (!partial || typeof partial !== 'object') return;
    state.settings = { ...state.settings, ...partial };
    pushState();
  });

  ipcMain.on('control:set-scene', (_e, sceneId) => {
    if (typeof sceneId !== 'string') return;
    state.sceneId = sceneId;
    pushState();
  });

  ipcMain.on('control:set-scene-setting', (_e, { sceneId, key, value }) => {
    if (typeof sceneId !== 'string' || typeof key !== 'string') return;
    if (!state.sceneSettings[sceneId]) state.sceneSettings[sceneId] = {};
    state.sceneSettings[sceneId][key] = value;
    pushState();
  });

  ipcMain.on('control:playlist', (_e, msg) => {
    if (!msg) return;
    if (msg.action === 'remove' && Number.isInteger(msg.index)) {
      state.playlist.splice(msg.index, 1);
      if (state.currentTrack >= state.playlist.length) state.currentTrack = 0;
      pushState();
    } else if (msg.action === 'select' && Number.isInteger(msg.index)) {
      state.currentTrack = msg.index;
      pushState();
      if (!displayWin) createDisplayWindow();
      sendTransport({ action: 'play', index: msg.index });
    } else if (msg.action === 'clear') {
      state.playlist = [];
      state.currentTrack = 0;
      pushState();
      sendTransport({ action: 'pause' });
    }
  });

  ipcMain.on('control:transport', (_e, cmd) => {
    if (!cmd) return;
    if ((cmd.action === 'play' || cmd.action === 'toggle') && !displayWin) {
      createDisplayWindow();
    }
    sendTransport(cmd);
  });

  ipcMain.on('control:open-display', () => createDisplayWindow());
  ipcMain.on('control:stop-show', () => {
    if (displayWin && !displayWin.isDestroyed()) displayWin.close();
  });
  ipcMain.on('control:toggle-fullscreen', toggleDisplayFullscreen);
  ipcMain.on('display:toggle-fullscreen', toggleDisplayFullscreen);
  ipcMain.on('display:exit-fullscreen', () => {
    if (displayWin && !displayWin.isDestroyed()) displayWin.setFullScreen(false);
  });

  ipcMain.on('display:ready', () => {
    displayReady = true;
    if (pendingTransport) {
      sendTransport(pendingTransport);
      pendingTransport = null;
    }
  });

  ipcMain.on('display:status', (_e, status) => {
    if (status && Number.isInteger(status.trackIndex)) {
      state.currentTrack = status.trackIndex;
    }
    if (controlWin && !controlWin.isDestroyed()) {
      controlWin.webContents.send('status:update', status);
    }
  });

  ipcMain.on('display:meter', (_e, meter) => {
    if (controlWin && !controlWin.isDestroyed()) {
      controlWin.webContents.send('meter:update', meter);
    }
  });
}

// ------------------------------------------------------------ lifecycle ----

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (controlWin) {
      if (controlWin.isMinimized()) controlWin.restore();
      controlWin.focus();
    }
  });

  app.whenReady().then(() => {
    loadState();
    registerIpc();
    createControlWindow();
    if (state.photoFolder) startWatching();
    if (process.env.PW_AUTOSHOW) createDisplayWindow();
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
