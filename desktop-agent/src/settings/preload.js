const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('actionclipSettings', {
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
  // Monitoring paused/resumed from the tray menu or the desktop widget while
  // this window is open (or hidden to tray) - keeps the General panel's
  // switch truthful so its Save button can't silently revert that change.
  onMonitoringChanged: (callback) => {
    const listener = (_e, enabled) => callback(enabled === true);
    ipcRenderer.on('settings:monitoring-changed', listener);
    return () => ipcRenderer.removeListener('settings:monitoring-changed', listener);
  }
});
