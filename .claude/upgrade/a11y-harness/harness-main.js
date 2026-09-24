// Standalone Electron main for a live a11y pass on TapAct's Settings window.
// Loads the REAL settings.html / settings.js / preload.js against the REAL
// lib/store.js (isolated userData dir), with the same IPC channel names main.js
// registers. No tray, no clipboard watcher, no global shortcuts.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const ROOT = process.env.TAPACT_ROOT;
const UD = process.env.HARNESS_USERDATA;
fs.rmSync(UD, { recursive: true, force: true });
fs.mkdirSync(UD, { recursive: true });
app.setPath('userData', UD);

const store = require(path.join(ROOT, 'src', 'lib', 'store.js'));
const { sanitizeSettingsPatch } = require(path.join(ROOT, 'src', 'lib', 'settings-guard.js'));

// ---- seed ----
store.saveSettings({ language: process.env.H_LANG || 'he', theme: process.env.H_THEME || 'dark' });
store.saveTemplates([
  { id: 't1', label: 'פנייה ראשונה', text: 'היי {שם}, ראיתי שהשארת פרטים', favorite: true },
  { id: 't2', label: 'תזכורת לפגישה', text: 'היי {שם}, מזכיר את הפגישה מחר', favorite: true },
  { id: 't3', label: 'הצעת מחיר', text: 'היי {שם}, מצרף הצעת מחיר', favorite: false },
  { id: 't4', label: 'מעקב', text: 'היי {שם}, רציתי לבדוק מה שלומך', favorite: false }
], 't1');
store.saveCustomActionRules([
  { id: 'r1', label: 'מספר הזמנה פנימי', pattern: 'ORD-(\\d+)', urlTemplate: 'https://crm.example.com/orders/{value}', actionLabel: 'פתח הזמנה', enabled: true },
  { id: 'r2', label: 'קוד לקוח', pattern: 'CUST-(\\d+)', urlTemplate: 'https://crm.example.com/c/{value}', actionLabel: '', enabled: true },
  { id: 'r3', label: 'כרטיס תמיכה', pattern: 'TKT-(\\d+)', urlTemplate: 'https://help.example.com/t/{value}', actionLabel: '', enabled: false }
]);
store.saveTagRules([{ id: 'g1', label: 'פרויקט', keywords: ['פרויקט', 'project'] }]);
store.addClipboardHistoryItem({ text: 'שלום John 050-1234567 ₪1,234', category: 'phone', actions: [{ label: 'WhatsApp' }], tags: [] });
store.addClipboardHistoryItem({ text: 'https://example.com/a/b', category: 'url', actions: [{ label: 'פתח קישור' }], tags: ['פרויקט'] });
store.addClipboardHistoryItem({ text: 'טקסט רגיל שהועתק', category: 'text' });
store.addHistoryEntry({ display: '050-1234567', normalized: '972501234567', name: 'John', templateLabel: 'פנייה ראשונה' });

// ---- IPC (mirrors main.js channel names) ----
ipcMain.handle('settings:get-data', () => ({
  templates: store.getTemplates(), defaultTemplateId: store.getDefaultTemplateId(), settings: store.getSettings(),
  version: '3.2.x-harness', buildDate: '2026-09-24',
  defaultShortcuts: { manual: 'CommandOrControl+Alt+P', history: 'Super+V', historyFallback: 'CommandOrControl+Alt+V' },
  shortcutStatus: { manual: true, history: false, historyFallback: true }
}));
ipcMain.on('settings:save-templates', (_e, { templates, defaultTemplateId }) => store.saveTemplates(templates, defaultTemplateId));
ipcMain.on('settings:reset-templates', () => store.resetTemplates());
ipcMain.on('settings:save-settings', (_e, s) => { const safe = sanitizeSettingsPatch(s); store.saveSettings(safe); });
ipcMain.handle('settings:get-history', () => store.getHistory());
ipcMain.on('settings:clear-history', () => store.clearHistory());
ipcMain.handle('settings:export-history-csv', () => ({ canceled: true }));
ipcMain.on('settings:clear-clipboard-history', () => store.clearClipboardHistory());
ipcMain.handle('settings:save-shortcuts', () => ({ manual: true, history: false, historyFallback: true }));
ipcMain.handle('settings:reset-shortcuts', () => ({ manual: true, history: false, historyFallback: true }));
ipcMain.handle('settings:get-tag-rules', () => store.getTagRules());
ipcMain.handle('settings:save-tag-rules', (_e, r) => store.saveTagRules(r));
ipcMain.handle('settings:get-custom-rules', () => store.getCustomActionRules());
ipcMain.handle('settings:save-custom-rules', (_e, r) => store.saveCustomActionRules(r));
ipcMain.handle('settings:get-lead-settings', () => store.getLeadSettings());
ipcMain.on('settings:save-lead-settings', (_e, s) => store.saveLeadSettings(s));
ipcMain.handle('settings:get-lead-history', () => store.getLeadHistory());
ipcMain.on('settings:clear-lead-history', () => store.clearLeadHistory());
ipcMain.handle('lead:test-channel', () => ({ ok: false, error: 'harness' }));
ipcMain.handle('settings:export-lead-history-csv', () => ({ canceled: true }));
ipcMain.on('settings:open-external', () => {});
ipcMain.handle('history-panel:get-data', (_e, { offset = 0, limit } = {}) => {
  const settings = store.getSettings();
  const page = store.getClipboardHistoryPage({ offset, limit: limit || 50 });
  return { items: page.items, total: page.total, historyEnabled: settings.historyEnabled !== false, tagRules: store.getTagRules(), settings };
});
ipcMain.on('history-panel:copy-item', () => {});
ipcMain.on('history-panel:run-action', () => {});
ipcMain.on('history-panel:delete-item', (_e, id) => store.deleteClipboardHistoryItem(id));
ipcMain.on('history-panel:clear-all', () => store.clearClipboardHistory());
ipcMain.on('history-panel:toggle-enabled', (_e, en) => store.saveSettings({ historyEnabled: en }));

global.__harnessStore = store;

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1040, height: 780, show: false, paintWhenInitiallyHidden: true,
    webPreferences: { preload: path.join(ROOT, 'src', 'settings', 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(ROOT, 'src', 'settings', 'settings.html'));
  win.once('ready-to-show', () => win.showInactive());
});
app.on('window-all-closed', () => app.quit());
