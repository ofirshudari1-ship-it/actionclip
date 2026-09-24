const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tapactHistory', {
  getData: (limit) => ipcRenderer.invoke('history-panel:get-data', { offset: 0, limit }),
  copyItem: (id) => ipcRenderer.send('history-panel:copy-item', id),
  runAction: (id, index) => ipcRenderer.send('history-panel:run-action', { id, index }),
  deleteItem: (id) => ipcRenderer.send('history-panel:delete-item', id),
  clearAll: () => ipcRenderer.send('history-panel:clear-all'),
  toggleEnabled: (enabled) => ipcRenderer.send('history-panel:toggle-enabled', enabled),
  dismiss: () => ipcRenderer.send('history-panel:dismiss'),
  onItemsChanged: (callback) => {
    ipcRenderer.on('history-panel:items-changed', callback);
    return () => ipcRenderer.removeListener('history-panel:items-changed', callback);
  }
});
