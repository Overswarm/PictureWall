const { contextBridge, ipcRenderer } = require('electron');

const VALID_INVOKE = new Set([
  'app:get-state',
  'dialog:choose-folder',
  'dialog:add-music',
  'media:read',
]);

const VALID_SEND = new Set([
  'control:set-settings',
  'control:set-scene',
  'control:set-scene-setting',
  'control:playlist',
  'control:transport',
  'control:open-display',
  'control:stop-show',
  'control:toggle-fullscreen',
  'display:toggle-fullscreen',
  'display:exit-fullscreen',
  'display:ready',
  'display:status',
  'display:meter',
]);

const VALID_ON = new Set([
  'state:update',
  'photos:update',
  'status:update',
  'meter:update',
  'transport',
  'display:open-changed',
]);

contextBridge.exposeInMainWorld('pw', {
  invoke(channel, ...args) {
    if (!VALID_INVOKE.has(channel)) return Promise.reject(new Error('Blocked channel: ' + channel));
    return ipcRenderer.invoke(channel, ...args);
  },
  send(channel, ...args) {
    if (VALID_SEND.has(channel)) ipcRenderer.send(channel, ...args);
  },
  on(channel, fn) {
    if (!VALID_ON.has(channel)) return () => {};
    const listener = (_e, ...args) => fn(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
});
