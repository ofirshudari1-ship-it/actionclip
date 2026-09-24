const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tapactSettings', {
  getData: () => ipcRenderer.invoke('settings:get-data'),
  saveTemplates: (templates, defaultTemplateId) =>
    ipcRenderer.send('settings:save-templates', { templates, defaultTemplateId }),
  resetTemplates: () => ipcRenderer.send('settings:reset-templates'),
  saveSettings: (settings) => ipcRenderer.send('settings:save-settings', settings),
  getHistory: () => ipcRenderer.invoke('settings:get-history'),
  clearHistory: () => ipcRenderer.send('settings:clear-history'),
  exportHistoryCsv: () => ipcRenderer.invoke('settings:export-history-csv'),
  clearClipboardHistory: () => ipcRenderer.send('settings:clear-clipboard-history'),
  saveShortcuts: (shortcuts) => ipcRenderer.invoke('settings:save-shortcuts', shortcuts),
  resetShortcuts: () => ipcRenderer.invoke('settings:reset-shortcuts'),
  getTagRules: () => ipcRenderer.invoke('settings:get-tag-rules'),
  saveTagRules: (rules) => ipcRenderer.invoke('settings:save-tag-rules', rules),
  getCustomRules: () => ipcRenderer.invoke('settings:get-custom-rules'),
  saveCustomRules: (rules) => ipcRenderer.invoke('settings:save-custom-rules', rules),
  getLeadSettings: () => ipcRenderer.invoke('settings:get-lead-settings'),
  saveLeadSettings: (settings) => ipcRenderer.send('settings:save-lead-settings', settings),
  getLeadHistory: () => ipcRenderer.invoke('settings:get-lead-history'),
  clearLeadHistory: () => ipcRenderer.send('settings:clear-lead-history'),
  testLeadChannel: (payload) => ipcRenderer.invoke('lead:test-channel', payload),
  exportLeadHistoryCsv: () => ipcRenderer.invoke('settings:export-lead-history-csv'),
  openExternal: (target) => ipcRenderer.send('settings:open-external', target),
  // Monitoring paused/resumed from the tray menu while this window is open
  // (or hidden to tray) - keeps the General panel's switch truthful so its
  // Save button can't silently revert that change.
  onMonitoringChanged: (callback) => {
    const listener = (_e, enabled) => callback(enabled === true);
    ipcRenderer.on('settings:monitoring-changed', listener);
    return () => ipcRenderer.removeListener('settings:monitoring-changed', listener);
  },
  // Clipboard history list, rendered as real DOM inside the
  // "clipboard-history" tab (settings.js). Same IPC channels the standalone
  // quick-access popup (clipboard-history/preload.js) uses - main.js's
  // handlers don't care which window/renderer called them.
  clipHistoryGetData: (limit) => ipcRenderer.invoke('history-panel:get-data', { offset: 0, limit }),
  clipHistoryCopyItem: (id) => ipcRenderer.send('history-panel:copy-item', id),
  clipHistoryRunAction: (id, index) => ipcRenderer.send('history-panel:run-action', { id, index }),
  clipHistoryDeleteItem: (id) => ipcRenderer.send('history-panel:delete-item', id),
  clipHistoryClearAll: () => ipcRenderer.send('history-panel:clear-all'),
  clipHistoryToggleEnabled: (enabled) => ipcRenderer.send('history-panel:toggle-enabled', enabled),
  onClipHistoryItemsChanged: (callback) => {
    ipcRenderer.on('history-panel:items-changed', callback);
    return () => ipcRenderer.removeListener('history-panel:items-changed', callback);
  }
});
