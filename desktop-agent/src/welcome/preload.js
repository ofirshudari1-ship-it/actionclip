const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('actionclipWelcome', {
  finish: () => ipcRenderer.send('welcome:finish'),
  skip: () => ipcRenderer.send('welcome:skip'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSetting: (key, value) => ipcRenderer.invoke('settings:save-one', { key, value }),
});
