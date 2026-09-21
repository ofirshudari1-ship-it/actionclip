const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('actionclipWidget', {
  getData: () => ipcRenderer.invoke('widget:get-init-data'),
  // Reuses the exact same toggle the tray menu's "ניטור לוח פעיל" checkbox
  // calls (toggleMonitoring in main.js) — see widget:toggle-monitoring.
  toggleMonitoring: () => ipcRenderer.invoke('widget:toggle-monitoring'),
  // Reuses the exact same window-open path the tray menu's "היסטוריית
  // העתקות" item calls (openHistoryWindow in main.js).
  openHistory: () => ipcRenderer.send('widget:open-history'),
  hide: () => ipcRenderer.send('widget:hide'),
  onStateChanged: (callback) => ipcRenderer.on('widget:state-changed', () => callback())
});
