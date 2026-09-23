const { app, Tray, Menu, BrowserWindow, clipboard, shell, screen, ipcMain, globalShortcut, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// File logger — writes to %APPDATA%\ActionClip\logs\actionclip.log
// Rotates when the file exceeds 5 MB (keeps previous file as .1).
const LOG_LEVELS = { INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' };
let _logStream = null;

function _getLogStream() {
  if (_logStream) return _logStream;
  try {
    const logsDir = path.join(app.getPath('userData'), '..', 'ActionClip', 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    const logFile = path.join(logsDir, 'actionclip.log');
    try {
      const stat = fs.statSync(logFile);
      if (stat.size > 5 * 1024 * 1024) {
        fs.renameSync(logFile, logFile + '.1');
      }
    } catch (_) { /* first run, file doesn't exist yet */ }
    _logStream = fs.createWriteStream(logFile, { flags: 'a', encoding: 'utf8' });
  } catch (_) { /* if we can't create logs, silently continue */ }
  return _logStream;
}

function log(level, msg, extra) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}${extra ? ' ' + JSON.stringify(extra) : ''}\n`;
  const stream = _getLogStream();
  if (stream) stream.write(line);
  if (level === LOG_LEVELS.ERROR) console.error(line.trimEnd());
  else if (level === LOG_LEVELS.WARN) console.warn(line.trimEnd());
}

const { findPhone, fillTemplate, buildWhatsAppUrl } = require('./lib/phone');
const { findGenericAction } = require('./lib/detectors');
const store = require('./lib/store');
const { postJson, cleanupLeadWithAi, buildShareText, buildMailtoUrl } = require('./lib/lead-delivery');
const { shouldHideToTray, shouldShowTrayHideHint, autoLaunchNeedsReconcile, resolveTrayClickTarget, resolveWidgetVisibility, widgetDefaultPosition, resolveWidgetPosition, buildWidgetState, shouldPrimeClipboardOnResume } = require('./lib/window-behavior');
const { sanitizeSettingsPatch } = require('./lib/settings-guard');
const { version: APP_VERSION } = require('../package.json');
const { buildDate: APP_BUILD_DATE } = (() => { try { return require('../../version.json'); } catch { return {}; } })();

// Default keyboard shortcuts - all overridable from Settings ▸ קיצורי מקלדת
// (see registerAllShortcuts). Win+V is Windows' own built-in clipboard-
// history shortcut; Electron can only register it once Windows itself
// isn't holding it anymore (Settings > System > Clipboard > Clipboard
// history, turned off) - that's a system-settings change this app can't
// make for the user. Ctrl+Alt+V is a fallback that works regardless.
const DEFAULT_SHORTCUTS = {
  manual: 'CommandOrControl+Alt+P',
  history: 'Super+V',
  historyFallback: 'CommandOrControl+Alt+V'
};

// Tracks which of the three logical shortcuts are actually registered right
// now, so Settings can show live status ("✓ פעיל" vs "✗ תפוס") instead of
// the user having to guess why a key combo silently does nothing.
let shortcutStatus = { manual: false, history: false, historyFallback: false };

// True only while an actual app quit is in progress (tray "יציאה", the
// auto-updater installing an update, etc.) — see shouldHideToTray in
// lib/window-behavior.js for why this flag exists: without it, "יציאה"
// would silently fail to quit whenever the Settings window happened to be
// open, because app.quit() closes windows the same way the user's own X
// button does, and would hit the same closeToTray interception.
let isQuitting = false;

let tray = null;
let popupWindow = null;
let actionPopupWindow = null;
let historyWindow = null;
let settingsWindow = null;
let widgetWindow = null;
let clipboardTimer = null;
let autoCloseTimer = null;
let autoRunTimer = null;

let lastClipboardText = '';
let lastNotifiedAt = new Map(); // normalized phone -> timestamp ms
let lastGenericNotifiedAt = new Map(); // "type:raw" -> timestamp ms
let currentPopupPhone = null; // { raw, normalized, display }
let currentGenericAction = null; // detector result, see lib/detectors/*.js

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// Password managers (1Password, Bitwarden, etc.) and Windows' own
// Clipboard History both respect this de-facto standard clipboard format
// to mean "don't log this copy anywhere" - honoring it here too means a
// copied password never lands in the on-disk clipboard history, without
// needing any password-specific detection of our own.
// electron@44's clipboard module is fully Promise-based (readText/writeText/
// read/has all return Promises now, modeled on the W3C navigator.clipboard
// API) - there is no synchronous availableFormats() anymore, so this reads
// clipboard.read()'s ClipboardItem[] and checks each item's .types instead.
async function clipboardExcludedFromHistory() {
  try {
    const items = await clipboard.read();
    return items.some((item) => item.types.some((t) => /exclude/i.test(t) && /monitor/i.test(t)));
  } catch (err) {
    return false;
  }
}

// Tags a clipboard text with the same category a detector would show a
// popup for, regardless of whether that detector is currently enabled -
// the history panel's point is to show what was actually copied, so
// categorization here is independent of the settings.detectors toggles
// that only gate the instant action popup. Generic detectors are checked
// before phone for the same reason checkClipboard does it below (an
// Israel Post tracking number's 9-digit run reads as a valid phone number
// under findPhone's loose heuristic).
// Reorders an action's actions[] so the user's preferred one (Settings ▸
// הגדרות ▸ פעולת ברירת מחדל, matched by the detector's own action `id`)
// comes first - that's the one the popup shows as its big primary button,
// the history panel's ▶ quick-action runs, and auto-run (if enabled) fires.
function applyActionPreference(action, settings) {
  if (!action || !action.actions || action.actions.length < 2) return action;
  const preferredId = (settings.actionPreferences || {})[action.type];
  if (!preferredId) return action;
  const idx = action.actions.findIndex((a) => a.id === preferredId);
  if (idx <= 0) return action;
  const reordered = [action.actions[idx], ...action.actions.filter((_, i) => i !== idx)];
  return { ...action, actions: reordered };
}

function categorizeForHistory(text) {
  const action = findGenericAction(text, { tracking: true, address: true, url: true, email: true }, store.getCustomActionRules());
  if (action) {
    const preferred = applyActionPreference(action, store.getSettings());
    return { category: preferred.type, actions: preferred.actions };
  }
  const phone = findPhone(text);
  if (phone) {
    return { category: 'phone', actions: [{ label: `WhatsApp: ${phone.display}`, url: buildWhatsAppUrl(phone.normalized, '') }] };
  }
  return { category: 'text', actions: null };
}

function startClipboardWatcher() {
  stopClipboardWatcher();
  const { pollMs } = store.getSettings();
  clipboardTimer = setInterval(checkClipboard, pollMs);
}

function stopClipboardWatcher() {
  if (clipboardTimer) clearInterval(clipboardTimer);
  clipboardTimer = null;
}

let clipboardCheckInFlight = false;

// electron@44's clipboard.readText() returns a Promise<string> (the whole
// clipboard module was migrated to the W3C navigator.clipboard-style async
// API - there is no synchronous string-returning readText() anymore, even
// though every version of this app before this fix called it as if there
// were). That mismatch is also the real explanation for the "clipboard
// sync quirk" this codebase used to blame for returning `{}` instead of a
// string: a Promise object is truthy and typeof 'object', so it slipped
// past `if (!text)` the same way any other unexpected object would, and
// crashed a few calls deep the same way. The typeof-string guard added for
// that crash was correct defense in depth, but it also meant every poll
// tick silently no-opped forever afterwards - detection was never actually
// broken by environment flakiness, it just never ran a single successful
// tick after that fix landed, on this Electron version.
async function checkClipboard() {
  const settings = store.getSettings();
  if (!settings.enabled) return;
  if (clipboardCheckInFlight) return; // don't overlap polls if one is still resolving
  clipboardCheckInFlight = true;

  let text;
  try {
    text = await clipboard.readText();
  } catch (err) {
    clipboardCheckInFlight = false;
    return;
  }
  if (typeof text !== 'string' || !text || text === lastClipboardText) {
    clipboardCheckInFlight = false;
    return;
  }
  lastClipboardText = text;

  if (settings.historyEnabled !== false && !(await clipboardExcludedFromHistory())) {
    const { category, actions } = categorizeForHistory(text);
    const tags = store.computeTags(text);
    store.addClipboardHistoryItem({ text, category, actions, tags });
    if (historyWindow && !historyWindow.isDestroyed()) {
      historyWindow.webContents.send('history-panel:items-changed');
    }
    // Only rebuild the tray's "recent actions" submenu when this copy
    // actually had one - keeps every other clipboard tick (the common
    // case: plain text with no detected action) from paying for a menu
    // rebuild it wouldn't change.
    if (actions && actions.length && tray && !tray.isDestroyed()) {
      tray.setContextMenu(buildTrayMenu());
      notifyWidget(); // refresh the widget's "recent action" row
    }
  }

  clipboardCheckInFlight = false;

  const dedupeMs = (settings.dedupeSeconds || 60) * 1000;

  // Generic detectors (tracking/address/url) run before phone on purpose:
  // findPhone's "bare 9-digit run" heuristic (see lib/phone.js) treats any
  // 9 consecutive digits as a landline missing its leading 0, which is
  // exactly the digit portion of an Israel Post S10 tracking number
  // (2 letters + 9 digits + 2 letters, e.g. RR123456789IL) - so checking
  // phone first used to steal every such tracking number into the WhatsApp
  // popup instead of the tracking one. Structured patterns (UPS/DHL/S10
  // prefixes, address regex, bare-URL) are inherently less prone to false
  // positives than that heuristic, so they get first refusal.
  const detectors = settings.detectors || {};
  const action = findGenericAction(text, detectors, store.getCustomActionRules());
  if (action) {
    const dedupeKey = `${action.type}:${action.raw}`;
    const lastSeen = lastGenericNotifiedAt.get(dedupeKey) || 0;
    if (Date.now() - lastSeen < dedupeMs) return;
    lastGenericNotifiedAt.set(dedupeKey, Date.now());
    if (isQuietHoursNow(settings)) return; // still logged to history above, just no popup
    currentGenericAction = applyActionPreference(action, settings);
    playDetectSound(settings);
    openActionPopupWindow();
    return;
  }

  if (detectors.phone !== false) {
    const found = findPhone(text);
    if (found) {
      const lastSeen = lastNotifiedAt.get(found.normalized) || 0;
      if (Date.now() - lastSeen < dedupeMs) return;
      lastNotifiedAt.set(found.normalized, Date.now());
      if (isQuietHoursNow(settings)) return;
      playDetectSound(settings);
      handlePhoneDetected(found, settings);
    }
  }
}

// True when "now" (local time) falls inside the configured quiet-hours
// window. Handles overnight ranges (e.g. 18:00 -> 08:00) by treating them
// as "outside [end, start)" instead of the usual "inside [start, end)".
function isQuietHoursNow(settings) {
  const qh = settings.quietHours;
  if (!qh || !qh.enabled) return false;
  const toMinutes = (hhmm) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
    if (!m) return null;
    return (parseInt(m[1], 10) % 24) * 60 + (parseInt(m[2], 10) % 60);
  };
  const start = toMinutes(qh.start);
  const end = toMinutes(qh.end);
  if (start == null || end == null || start === end) return false;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (start < end) return nowMin >= start && nowMin < end;
  // Overnight window (crosses midnight)
  return nowMin >= start || nowMin < end;
}

function playDetectSound(settings) {
  if (settings.soundOnDetect) {
    try { shell.beep(); } catch (_) { /* not fatal - just skip the beep */ }
  }
}

// Manual trigger (tray menu item or global shortcut): re-reads the
// clipboard right now regardless of the poll interval or dedupe cooldown,
// and opens a popup either way - with whatever was detected, or the phone
// popup empty so the rep can paste/type a number by hand (same fallback
// the Chrome extension offers when a copy doesn't contain a recognizable
// number).
async function triggerManualPopup() {
  let text = '';
  try {
    text = await clipboard.readText();
  } catch (err) {
    text = '';
  }
  if (typeof text !== 'string') text = '';

  const settings = store.getSettings();

  const detectorsCfg = settings.detectors || {};
  const action = findGenericAction(text, detectorsCfg, store.getCustomActionRules()); // see checkClipboard for why this runs first
  if (action) {
    currentGenericAction = applyActionPreference(action, settings);
    openActionPopupWindow();
    return;
  }

  const phone = detectorsCfg.phone !== false ? findPhone(text) : null;
  if (phone) {
    handlePhoneDetected(phone, store.getSettings());
    return;
  }

  currentPopupPhone = null;
  openPopupWindow();
}

function handlePhoneDetected(phone, settings) {
  const action = (settings.actionPreferences || {}).phone || 'popup';
  if (action === 'none') return;
  if (action === 'call') {
    shell.openExternal('tel:' + phone.normalized);
    return;
  }
  if (action === 'whatsapp') {
    shell.openExternal(buildWhatsAppUrl(phone.normalized, ''));
    return;
  }
  // default: 'popup'
  currentPopupPhone = phone;
  openPopupWindow();
}

function openPopupWindow() {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close();
  }

  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const width = 360;
  const height = 620;
  let x = cursor.x + 12;
  let y = cursor.y + 12;
  const bounds = display.workArea;
  if (x + width > bounds.x + bounds.width) x = bounds.x + bounds.width - width - 8;
  if (y + height > bounds.y + bounds.height) y = bounds.y + bounds.height - height - 8;
  x = Math.max(bounds.x + 8, x);
  y = Math.max(bounds.y + 8, y);

  popupWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    minWidth: 320,
    minHeight: 400,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'popup', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  popupWindow.loadFile(path.join(__dirname, 'popup', 'popup.html'));
  popupWindow.once('ready-to-show', () => {
    popupWindow.show();
    resetAutoCloseTimer();
    // Tray balloon notification on phone detection
    const s = store.getSettings();
    if (s.showTrayNotification !== false && tray && !tray.isDestroyed()) {
      tray.displayBalloon({
        iconType: 'info',
        title: 'ActionClip — מספר זוהה',
        content: currentPopupPhone ? currentPopupPhone.display : 'מספר טלפון חדש זוהה',
        largeIcon: false,
        noSound: true
      });
    }
  });
  popupWindow.on('closed', () => {
    popupWindow = null;
    clearAutoCloseTimer();
  });
}

function openActionPopupWindow() {
  if (actionPopupWindow && !actionPopupWindow.isDestroyed()) {
    actionPopupWindow.close();
  }

  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const width = 320;
  const bounds = display.workArea;
  // Long/wrapped custom-rule action labels can push actual content past this
  // estimate; the popup body scrolls internally (action-popup.css) as a
  // safety net, but we still cap the window itself to the visible work area
  // so it never tries to render off-screen on small/scaled displays.
  const estimatedHeight = 130 + 46 * ((currentGenericAction && currentGenericAction.actions.length) || 1);
  const height = Math.min(estimatedHeight, bounds.height - 16);
  let x = cursor.x + 12;
  let y = cursor.y + 12;
  if (x + width > bounds.x + bounds.width) x = bounds.x + bounds.width - width - 8;
  if (y + height > bounds.y + bounds.height) y = bounds.y + bounds.height - height - 8;
  x = Math.max(bounds.x + 8, x);
  y = Math.max(bounds.y + 8, y);

  actionPopupWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'action-popup', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  actionPopupWindow.loadFile(path.join(__dirname, 'action-popup', 'action-popup.html'));
  actionPopupWindow.once('ready-to-show', () => {
    actionPopupWindow.show();
    resetAutoCloseTimer();
    resetAutoRunTimer();
  });
  actionPopupWindow.on('closed', () => {
    actionPopupWindow = null;
    clearAutoCloseTimer();
  });
}

function closePopup() {
  if (popupWindow && !popupWindow.isDestroyed()) popupWindow.close();
  if (actionPopupWindow && !actionPopupWindow.isDestroyed()) actionPopupWindow.close();
  clearAutoRunTimer();
}

// The clipboard-history panel (Win+V equivalent): browses everything
// logged in store.getClipboardHistory(), not tied to any single detection
// like the two popups above. No auto-close timer - unlike a "here's what
// you just copied" popup, this is a place to linger and search, so it only
// closes on an explicit click-away/Escape/action, same as Win+V's own UI.
function openHistoryWindow() {
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.focus();
    return;
  }

  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const width = 380;
  const height = 560;
  let x = cursor.x + 12;
  let y = cursor.y + 12;
  const bounds = display.workArea;
  if (x + width > bounds.x + bounds.width) x = bounds.x + bounds.width - width - 8;
  if (y + height > bounds.y + bounds.height) y = bounds.y + bounds.height - height - 8;
  x = Math.max(bounds.x + 8, x);
  y = Math.max(bounds.y + 8, y);

  historyWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'clipboard-history', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  historyWindow.loadFile(path.join(__dirname, 'clipboard-history', 'clipboard-history.html'));
  historyWindow.once('ready-to-show', () => historyWindow.show());
  historyWindow.on('blur', () => {
    if (historyWindow && !historyWindow.isDestroyed()) historyWindow.close();
  });
  historyWindow.on('closed', () => { historyWindow = null; });
}

// --- Persistent desktop widget (src/widget/) ---
//
// Small, frameless, always-on-top status panel — the app's only persistent
// visible presence beyond the tray icon, since ActionClip is otherwise
// tray-first with zero windows on most launches. Shown/hidden purely off
// Settings ▸ "הצג ווידג'ט על שולחן העבודה" (widgetEnabled, on by default -
// see resolveWidgetVisibility in lib/window-behavior.js).

const WIDGET_WIDTH = 240;
const WIDGET_HEIGHT = 156;
let widgetPositionSaveTimer = null;

// Re-reads the clipboard right now and records it as "already seen", without
// logging or acting on it. Called just before monitoring resumes: the poll
// loop doesn't read the clipboard at all while paused, so without this the
// first tick after resuming would treat whatever was copied DURING the pause
// as new and write it to the on-disk history (and pop a popup for it) -
// exactly what the user paused to avoid. See shouldPrimeClipboardOnResume.
async function primeClipboardBaseline() {
  try {
    const text = await clipboard.readText();
    if (typeof text === 'string') lastClipboardText = text;
  } catch (_) { /* unreadable clipboard - nothing to baseline against */ }
}

// Single source of truth for pausing/resuming monitoring, shared by the
// tray menu's "ניטור לוח פעיל" checkbox, the widget's pause/resume button
// AND the Settings window's General > monitoring switch - none of them
// reimplement this, so the surfaces can never drift out of sync.
async function setMonitoringEnabled(next) {
  const wasEnabled = store.getSettings().enabled;
  if (shouldPrimeClipboardOnResume({ wasEnabled, willBeEnabled: next })) {
    await primeClipboardBaseline(); // BEFORE saving, so no poll tick can slip in between
  }
  store.saveSettings({ enabled: next });
  if (wasEnabled !== next) log(LOG_LEVELS.INFO, `Clipboard monitoring ${next ? 'resumed' : 'paused'}`);
  broadcastMonitoringState();
  return next;
}

function toggleMonitoring(forceValue) {
  const next = typeof forceValue === 'boolean' ? forceValue : !store.getSettings().enabled;
  return setMonitoringEnabled(next);
}

// Pushes the current monitoring state to every surface that displays it:
// tray menu/tooltip, desktop widget, and an open (or hidden-to-tray)
// Settings window. The Settings push matters for correctness, not just
// looks: its General panel "Save" sends `enabled` from its own checkbox, so
// a stale checkbox (monitoring paused from the tray/widget while Settings
// was open) used to silently turn monitoring back on the next time the user
// saved any unrelated general setting.
function broadcastMonitoringState() {
  const { enabled } = store.getSettings();
  if (tray && !tray.isDestroyed()) tray.setContextMenu(buildTrayMenu());
  notifyWidget();
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('settings:monitoring-changed', enabled);
  }
}

function notifyWidget() {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('widget:state-changed');
  }
}

// After clipboard history is deleted/cleared, both places that summarize it
// must drop what they were showing: the tray's "recent actions" submenu
// (which previews the copied TEXT itself - leaving it would keep showing
// content the user just explicitly deleted) and the widget's recent row.
function refreshHistorySummaries() {
  if (tray && !tray.isDestroyed()) tray.setContextMenu(buildTrayMenu());
  notifyWidget();
}

function createWidgetWindow() {
  if (widgetWindow && !widgetWindow.isDestroyed()) return;

  const settings = store.getSettings();
  // A saved position is only reused if it still lands on a display that
  // exists now (monitor unplugged / resolution changed -> back to default,
  // STANDARDS.md §12.3) - otherwise the widget could reopen invisible.
  const pos = resolveWidgetPosition({
    saved: settings.widgetPosition,
    workAreas: screen.getAllDisplays().map((d) => d.workArea),
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT
  }) || widgetDefaultPosition({
    workArea: screen.getPrimaryDisplay().workArea,
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT
  });

  widgetWindow = new BrowserWindow({
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'widget', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  widgetWindow.loadFile(path.join(__dirname, 'widget', 'widget.html'));
  widgetWindow.once('ready-to-show', () => {
    // showInactive(): visible immediately without stealing focus from
    // whatever window/app the user is currently working in.
    if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.showInactive();
  });

  // Persists the dragged position (debounced - 'moved' fires continuously
  // while dragging) using the same settings store every other window in
  // this app already uses.
  widgetWindow.on('moved', () => {
    if (!widgetWindow || widgetWindow.isDestroyed()) return;
    const [x, y] = widgetWindow.getPosition();
    clearTimeout(widgetPositionSaveTimer);
    widgetPositionSaveTimer = setTimeout(() => store.saveSettings({ widgetPosition: { x, y } }), 400);
  });

  widgetWindow.on('closed', () => { widgetWindow = null; });
}

// Applies the current widgetEnabled setting: shows (creating it on first
// use) or hides the widget window. Called on startup and live from
// Settings, so toggling "הצג ווידג'ט על שולחן העבודה" takes effect
// immediately without a restart.
function applyWidgetVisibility() {
  const show = resolveWidgetVisibility(store.getSettings());
  if (show) {
    if (!widgetWindow || widgetWindow.isDestroyed()) createWidgetWindow();
    else if (!widgetWindow.isVisible()) widgetWindow.showInactive();
  } else if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.hide();
  }
}

function resetAutoCloseTimer() {
  clearAutoCloseTimer();
  const { autoCloseSeconds } = store.getSettings();
  if (!autoCloseSeconds) return;
  autoCloseTimer = setTimeout(closePopup, autoCloseSeconds * 1000);
}

function clearAutoCloseTimer() {
  if (autoCloseTimer) clearTimeout(autoCloseTimer);
  autoCloseTimer = null;
}

// Optional (off by default, Settings ▸ הגדרות ▸ הרצה אוטומטית): fires the
// action popup's primary action by itself after autoRunDelaySeconds,
// instead of waiting for a click - the popup still shows first so there's
// a visible window to cancel by closing it. Phone popups don't get this -
// they need the name/template filled in first, which isn't something to
// auto-fire.
function resetAutoRunTimer() {
  clearAutoRunTimer();
  const settings = store.getSettings();
  if (!settings.autoRunAction) return;
  const delay = Math.max(1, settings.autoRunDelaySeconds || 4);
  autoRunTimer = setTimeout(() => {
    const action = currentGenericAction;
    const chosen = action && action.actions && action.actions[0];
    if (chosen && chosen.url) shell.openExternal(chosen.url);
    closePopup();
  }, delay * 1000);
}

function clearAutoRunTimer() {
  if (autoRunTimer) clearTimeout(autoRunTimer);
  autoRunTimer = null;
}

let welcomeWindow = null;
let splashWindow = null;

// STANDARDS.md §19: minimum on-screen time (avoids a flash-of-splash on a
// fast local load) and a safety timeout (guarantees the splash can never get
// stuck forever if something upstream hangs).
const SPLASH_MIN_MS = 800;
const SPLASH_SAFETY_TIMEOUT_MS = 8000;

function maybeShowWelcome() {
  // ActionClip is a tray-first background agent — on every launch after the
  // very first one, isWelcomeSeen() is true and the app goes straight to the
  // tray with zero windows (see app.whenReady below). A splash screen only
  // makes sense for the one case where a window does appear on startup: the
  // first-run welcome screen. It is intentionally skipped on all later
  // launches and when reopened from the tray's "מה זה ActionClip?" item
  // (openWelcomeWindow) — a branded loading screen in front of an
  // already-seen, instantly-loading local window would just be an
  // unnecessary delay, not real loading feedback.
  if (!store.isWelcomeSeen()) showFirstRunWelcomeWithSplash();
}

// Branded splash screen per STANDARDS.md §19 — frameless, transparent,
// rounded corners via CSS, ActionClip's brand gradient (assets/BRAND.md),
// the real app logo as the dominant element, and a continuous spinner
// (no fake progress bar, since there's no real percentage to report for a
// local file load).
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 320,
    height: 320,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    center: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  splashWindow.loadFile(path.join(__dirname, 'splash', 'splash.html'));
  splashWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.show();
  });
  return Date.now();
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  splashWindow = null;
}

// Shows the splash, then creates the first-run welcome window with
// `show: false` and only reveals it once its content is actually ready
// (`ready-to-show`) — enforcing SPLASH_MIN_MS before closing the splash so a
// near-instant local load doesn't flicker, and SPLASH_SAFETY_TIMEOUT_MS so a
// stuck load can never leave the splash on screen forever (STANDARDS.md
// §19.2).
function showFirstRunWelcomeWithSplash() {
  const splashShownAt = createSplash();

  const win = new BrowserWindow({
    width: 480,
    height: 560,
    resizable: false,
    frame: false,
    center: true,
    show: false,
    title: 'ברוכים הבאים ל-ActionClip',
    webPreferences: {
      preload: path.join(__dirname, 'welcome', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  welcomeWindow = win;
  win.loadFile(path.join(__dirname, 'welcome', 'welcome.html'));
  win.on('closed', () => { welcomeWindow = null; });

  let revealed = false;
  const reveal = () => {
    if (revealed || win.isDestroyed()) return;
    revealed = true;
    const elapsed = Date.now() - splashShownAt;
    const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
    setTimeout(() => {
      closeSplash();
      if (!win.isDestroyed()) win.show();
    }, remaining);
  };

  win.once('ready-to-show', reveal);
  // Safety timeout: fires independently of `reveal` above and is a no-op if
  // reveal() already ran, so a hung load still guarantees the splash (and
  // then the welcome window, ready or not) is shown within 8s.
  setTimeout(() => {
    if (revealed) return;
    revealed = true;
    closeSplash();
    if (win && !win.isDestroyed()) win.show();
  }, SPLASH_SAFETY_TIMEOUT_MS);
}

// First-run onboarding: a few steps explaining what ActionClip actually
// does, with a skip option at every step - opens automatically once (see
// maybeShowWelcome), and any time after that from the tray menu ("מה זה
// ActionClip") for anyone who wants the tour again.
function openWelcomeWindow() {
  if (welcomeWindow && !welcomeWindow.isDestroyed()) {
    welcomeWindow.focus();
    return;
  }
  welcomeWindow = new BrowserWindow({
    width: 480,
    height: 560,
    resizable: false,
    frame: false,
    center: true,
    title: 'ברוכים הבאים ל-ActionClip',
    webPreferences: {
      preload: path.join(__dirname, 'welcome', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  welcomeWindow.loadFile(path.join(__dirname, 'welcome', 'welcome.html'));
  welcomeWindow.on('closed', () => { welcomeWindow = null; });
}

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 720,
    height: 760,
    minWidth: 640,
    minHeight: 600,
    title: 'ActionClip - הגדרות',
    webPreferences: {
      preload: path.join(__dirname, 'settings', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, 'settings', 'settings.html'));
  settingsWindow.on('close', (e) => {
    const settings = store.getSettings();
    if (shouldHideToTray({ closeToTray: settings.closeToTray, isQuitting, hasTray: tray && !tray.isDestroyed() })) {
      e.preventDefault();
      settingsWindow.hide();
      maybeShowTrayHideHint(settings);
    }
  });
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

// First time (only) a window is hidden instead of closed, tell the user
// where it went via a tray balloon — directly answers the "wait, did it
// close?" confusion a tray app's two kinds of 'close' can otherwise cause.
function maybeShowTrayHideHint(settings) {
  if (!shouldShowTrayHideHint({ hideHintSeen: settings.trayHideHintSeen, showTrayNotification: settings.showTrayNotification })) return;
  store.saveSettings({ trayHideHintSeen: true });
  if (tray && !tray.isDestroyed()) {
    tray.displayBalloon({
      iconType: 'info',
      title: 'ActionClip ממשיך לרוץ',
      content: 'החלון נסגר אבל ActionClip עדיין פעיל במגש. ליציאה מלאה: קליק ימני על האייקון > יציאה.',
      largeIcon: false,
      noSound: true
    });
  }
}

const CATEGORY_TRAY_ICON = { phone: '📞', tracking: '📦', address: '🗺️', url: '🔗', email: '✉️', custom: '⚡', text: '📋' };

// Tray-menu label for one recent-actions entry: icon + a short preview of
// what was copied, truncated so it doesn't blow out the menu's width.
function trayActionLabel(item) {
  const icon = CATEGORY_TRAY_ICON[item.category] || '📋';
  const preview = (item.text || '').replace(/\s+/g, ' ').trim().slice(0, 34);
  return `${icon} ${preview}${item.text && item.text.length > 34 ? '…' : ''}`;
}

// "Recent actions" quick-repeat submenu (Raycast/ClipboardFusion-style):
// re-fires the primary action of one of the last few detected copies
// directly from the tray, without reopening the full history panel or
// re-copying anything.
function buildRecentActionsSubmenu() {
  const recent = store.getRecentActionableHistory(5);
  if (!recent.length) {
    return [{ label: '(אין פעולות אחרונות)', enabled: false }];
  }
  return recent.map((item) => ({
    label: trayActionLabel(item),
    sublabel: item.actions[0].label,
    click: () => {
      const chosen = item.actions[0];
      if (chosen && chosen.url) shell.openExternal(chosen.url);
    }
  }));
}

function buildTrayMenu() {
  const settings = store.getSettings();
  const configured = { ...DEFAULT_SHORTCUTS, ...(settings.shortcuts || {}) };
  if (tray) tray.setToolTip(settings.enabled ? 'ActionClip - מוכן להעתקה' : 'ActionClip - ניטור מושהה');
  return Menu.buildFromTemplate([
    { label: settings.enabled ? 'ActionClip - פעיל' : 'ActionClip - מושהה', enabled: false },
    { type: 'separator' },
    {
      label: 'ניטור לוח פעיל',
      type: 'checkbox',
      checked: settings.enabled,
      click: (menuItem) => toggleMonitoring(menuItem.checked)
    },
    { label: `פתח ידנית (${configured.manual.replace('CommandOrControl', 'Ctrl')})`, click: triggerManualPopup },
    { label: 'פעולות אחרונות', submenu: buildRecentActionsSubmenu() },
    { label: `היסטוריית העתקות (${configured.history} / ${configured.historyFallback.replace('CommandOrControl', 'Ctrl')})`, click: openHistoryWindow },
    {
      label: `רענן קיצורי מקלדת ${shortcutStatus.history ? '' : '(Win+V עדיין לא נתפס ⚠)'}`,
      click: () => {
        registerAllShortcuts();
        tray.setContextMenu(buildTrayMenu());
      }
    },
    {
      label: settingsWindow && !settingsWindow.isDestroyed() ? 'הצג הגדרות' : 'הגדרות ותבניות...',
      click: () => {
        if (settingsWindow && !settingsWindow.isDestroyed()) {
          settingsWindow.show();
          settingsWindow.focus();
        } else {
          openSettingsWindow();
        }
      }
    },
    { label: 'מה זה ActionClip? (הדרכה)', click: openWelcomeWindow },
    { type: 'separator' },
    {
      label: 'יציאה',
      click: () => {
        // Must be set before app.quit(): see the isQuitting comment at its
        // declaration and shouldHideToTray in lib/window-behavior.js. Without
        // this, quitting while the Settings window is open would hit its
        // closeToTray interception and silently cancel the whole quit.
        isQuitting = true;
        app.quit();
      }
    }
  ]);
}

function handleTrayClick() {
  const settings = store.getSettings();
  const target = resolveTrayClickTarget(settings.trayClickAction);
  if (target === 'history') openHistoryWindow();
  else if (target === 'settings') openSettingsWindow();
}

function createTray() {
  tray = new Tray(path.join(ASSETS_DIR, 'tray.png'));
  tray.setContextMenu(buildTrayMenu());
  // Left single-click: configurable via Settings ▸ הגדרות (trayClickAction) -
  // defaults to opening the clipboard-history panel, the most commonly
  // reached-for action. Right-click always shows the full context menu
  // (Electron's default, unaffected by this) - that's still the only path
  // to "יציאה" so quitting is never one accidental click away.
  tray.on('click', handleTrayClick);
  tray.on('double-click', openSettingsWindow);
}

// --- IPC: popup window ---

ipcMain.handle('popup:get-init-data', () => {
  const templates = store.getTemplates();
  const defaultTemplateId = store.getDefaultTemplateId();
  const settings = store.getSettings();
  return {
    phone: currentPopupPhone,
    templates,
    defaultTemplateId,
    history: store.getHistory(),
    sendDedupeMinutes: settings.sendDedupeMinutes,
    leadSettings: store.getLeadSettings(),
    leadHistory: store.getLeadHistory(),
    settings
  };
});

ipcMain.handle('popup:check-phone', (_event, text) => findPhone(text || ''));

ipcMain.on('popup:send', (_event, { phone, message, name, templateLabel }) => {
  // `phone` comes from the renderer's own state, not currentPopupPhone -
  // the rep may have typed a different number into the manual-entry
  // fallback than whatever (if anything) was auto-detected on open.
  // NOTE: popup is NOT closed here so multi-channel sends can complete;
  // the renderer calls popup:dismiss after all channels finish.
  if (phone && phone.normalized) {
    shell.openExternal(buildWhatsAppUrl(phone.normalized, message));
    store.addHistoryEntry({
      normalized: phone.normalized,
      display: phone.display,
      name: (name || '').trim(),
      templateLabel: templateLabel || ''
    });
    // Also record in lead history so duplicate detection works across channels
    store.addLeadHistoryEntry({
      name: (name || '').trim(),
      phone: phone.display || phone.normalized,
      role: '', source: '',
      channel: 'whatsapp'
    });
  }
});

ipcMain.on('popup:dismiss', () => closePopup());
ipcMain.on('popup:open-settings', () => openSettingsWindow());
ipcMain.on('popup:open-lead-settings', () => openSettingsWindow());
ipcMain.on('popup:activity', () => resetAutoCloseTimer());

// --- IPC: lead capture multi-channel delivery ---

ipcMain.handle('lead:send-channel', async (_event, { channel, lead }) => {
  // Always read sensitive config (URLs, auth headers) from the trusted store —
  // never from renderer-supplied leadSettings to prevent SSRF.
  const ls = store.getLeadSettings();
  try {
    if (channel === 'webhook') {
      const result = await postJson(ls.webhookUrl, { ...lead, sentAt: new Date().toISOString() }, ls.webhookHeaderName, ls.webhookHeaderValue);
      if (result.ok) store.addLeadHistoryEntry({ ...lead, channel: 'webhook' });
      return result;
    }
    if (channel === 'slack') {
      const text = buildShareText(lead, ls.messageTemplate);
      const result = await postJson(ls.slackWebhookUrl, { text });
      if (result.ok) store.addLeadHistoryEntry({ ...lead, channel: 'slack' });
      return result;
    }
    if (channel === 'email') {
      const url = buildMailtoUrl(lead, ls.emailAddress, ls.messageTemplate);
      shell.openExternal(url);
      store.addLeadHistoryEntry({ ...lead, channel: 'email' });
      return { ok: true };
    }
    if (channel === 'copy') {
      const text = buildShareText(lead, ls.messageTemplate);
      clipboard.writeText(text);
      store.addLeadHistoryEntry({ ...lead, channel: 'copy' });
      return { ok: true };
    }
    return { ok: false, error: `ערוץ לא מוכר: ${channel}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('lead:ai-cleanup', async (_event, lead) => {
  const { aiApiKey } = store.getLeadSettings();
  return cleanupLeadWithAi(lead, aiApiKey);
});

ipcMain.handle('lead:test-channel', async (_event, { channel }) => {
  // Read URL and auth headers from the trusted store — never from renderer input.
  const ls = store.getLeadSettings();
  let url = '';
  let headerName = '';
  let headerValue = '';
  if (channel === 'webhook') { url = ls.webhookUrl; headerName = ls.webhookHeaderName || ''; headerValue = ls.webhookHeaderValue || ''; }
  else if (channel === 'slack') { url = ls.slackWebhookUrl; }
  if (!url) return { ok: false, error: 'URL ריק — הגדר אותו בהגדרות' };
  try {
    const testPayload = { test: true, source: 'ActionClip', timestamp: new Date().toISOString() };
    const result = await postJson(url, testPayload, headerName, headerValue);
    return result;
  } catch (e) {
    return { ok: false, error: e.message || 'שגיאת חיבור' };
  }
});

// --- IPC: lead settings (from settings window) ---

ipcMain.handle('settings:get-lead-settings', () => store.getLeadSettings());
ipcMain.on('settings:save-lead-settings', (_event, settings) => store.saveLeadSettings(settings));

ipcMain.on('settings:open-external', (_event, target) => {
  const urls = {
    changelog: 'https://actionclip.app/changelog',
    site: 'https://actionclip.app'
  };
  const url = urls[target];
  if (url) shell.openExternal(url);
});
ipcMain.handle('settings:get-lead-history', () => store.getLeadHistory());
ipcMain.on('settings:clear-lead-history', () => store.clearLeadHistory());

// --- IPC: generic action popup (tracking / address / url detectors) ---

ipcMain.handle('action-popup:get-init-data', () => ({ action: currentGenericAction }));

ipcMain.on('action-popup:run', (_event, index) => {
  const action = currentGenericAction;
  const chosen = action && action.actions && action.actions[index];
  if (chosen && chosen.url) shell.openExternal(chosen.url);
  closePopup();
});

ipcMain.on('action-popup:dismiss', () => closePopup());
ipcMain.on('action-popup:open-settings', () => openSettingsWindow());
ipcMain.on('action-popup:activity', () => { resetAutoCloseTimer(); resetAutoRunTimer(); });

// --- IPC: clipboard-history panel (Win+V-style) ---

ipcMain.handle('history-panel:get-data', (_event, { offset = 0, limit } = {}) => {
  const settings = store.getSettings();
  const page = store.getClipboardHistoryPage({ offset, limit: limit || settings.historyPreviewLimit || 50 });
  return {
    items: page.items,
    total: page.total,
    historyEnabled: settings.historyEnabled !== false,
    tagRules: store.getTagRules()
  };
});

ipcMain.on('history-panel:copy-item', async (_event, id) => {
  const item = store.getClipboardHistory().find((i) => i.id === id);
  if (item) {
    lastClipboardText = item.text; // re-copying a history item shouldn't re-trigger its own detector popup
    await clipboard.writeText(item.text);
  }
  if (historyWindow && !historyWindow.isDestroyed()) historyWindow.close();
});

ipcMain.on('history-panel:run-action', (_event, { id, index }) => {
  const item = store.getClipboardHistory().find((i) => i.id === id);
  const chosen = item && item.actions && item.actions[index];
  if (chosen && chosen.url) shell.openExternal(chosen.url);
  if (historyWindow && !historyWindow.isDestroyed()) historyWindow.close();
});

ipcMain.on('history-panel:delete-item', (_event, id) => {
  if (typeof id !== 'string') return;
  store.deleteClipboardHistoryItem(id);
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.webContents.send('history-panel:items-changed');
  }
  refreshHistorySummaries();
});

ipcMain.on('history-panel:clear-all', () => {
  store.clearClipboardHistory();
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.webContents.send('history-panel:items-changed');
  }
  refreshHistorySummaries();
});

ipcMain.on('history-panel:toggle-enabled', (_event, enabled) => {
  if (typeof enabled !== 'boolean') return;
  store.saveSettings({ historyEnabled: enabled });
});

ipcMain.on('history-panel:dismiss', () => {
  if (historyWindow && !historyWindow.isDestroyed()) historyWindow.close();
});

// --- IPC: desktop widget ---

// Payload is built by buildWidgetState (lib/window-behavior.js), which only
// ever passes through monitoring state, UI language and the *category* +
// timestamp of the latest detected action - never the copied text or its
// action labels/URLs. The widget renders the localized label itself.
ipcMain.handle('widget:get-init-data', () => buildWidgetState({
  settings: store.getSettings(),
  recentItem: store.getRecentActionableHistory(1)[0] || null
}));

// Reuses toggleMonitoring — the exact same function the tray menu's
// "ניטור לוח פעיל" checkbox calls - so the two surfaces never drift apart.
ipcMain.handle('widget:toggle-monitoring', () => toggleMonitoring());

// Reuses openHistoryWindow — the exact same function the tray menu's
// "היסטוריית העתקות" item calls.
ipcMain.on('widget:open-history', () => openHistoryWindow());

ipcMain.on('widget:hide', () => {
  if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.hide();
});

// --- IPC: welcome / onboarding window ---

ipcMain.on('welcome:finish', () => {
  store.markWelcomeSeen();
  if (welcomeWindow && !welcomeWindow.isDestroyed()) welcomeWindow.close();
});
ipcMain.on('welcome:skip', () => {
  store.markWelcomeSeen();
  if (welcomeWindow && !welcomeWindow.isDestroyed()) welcomeWindow.close();
});

// --- IPC: settings window ---

ipcMain.handle('settings:get', () => store.getSettings());
// Used by the welcome window's language/theme toggles. Goes through the same
// allowlist + type validation as 'settings:save-settings' (previously it
// wrote any key/value the renderer sent straight into the store).
ipcMain.handle('settings:save-one', (_e, payload) => {
  const { key, value } = payload || {};
  if (typeof key !== 'string') return false;
  const safe = sanitizeSettingsPatch({ [key]: value });
  if (!Object.keys(safe).length) return false;
  store.saveSettings(safe);
  if ('language' in safe) notifyWidget(); // widget follows the UI language live
  return true;
});

ipcMain.handle('settings:get-data', () => ({
  templates: store.getTemplates(),
  defaultTemplateId: store.getDefaultTemplateId(),
  settings: store.getSettings(),
  version: APP_VERSION,
  buildDate: APP_BUILD_DATE || '',
  defaultShortcuts: DEFAULT_SHORTCUTS,
  shortcutStatus
}));

ipcMain.on('settings:save-templates', (_event, { templates, defaultTemplateId }) => {
  store.saveTemplates(templates, defaultTemplateId);
});

ipcMain.on('settings:reset-templates', () => store.resetTemplates());

// Allowlist + per-key type validation lives in lib/settings-guard.js
// (SETTINGS_ALLOWLIST / sanitizeSettingsPatch) - shared with
// 'settings:save-one' above so both write paths enforce the same rules.
ipcMain.on('settings:save-settings', async (_event, settings) => {
  const safe = sanitizeSettingsPatch(settings);
  // Monitoring on/off goes through the same path as the tray and widget
  // (baseline-on-resume, broadcast to every surface), not a raw store write.
  const hasEnabled = Object.prototype.hasOwnProperty.call(safe, 'enabled');
  const nextEnabled = safe.enabled;
  delete safe.enabled;
  store.saveSettings(safe);
  if (hasEnabled && nextEnabled !== store.getSettings().enabled) {
    await setMonitoringEnabled(nextEnabled);
  }
  startClipboardWatcher();
  applyAutoLaunch();
  registerAllShortcuts();
  if (tray) tray.setContextMenu(buildTrayMenu());
  // Live toggle: takes effect immediately, without a restart, whether the
  // widget is being shown for the first time or hidden.
  if (Object.prototype.hasOwnProperty.call(safe, 'widgetEnabled')) applyWidgetVisibility();
  notifyWidget(); // e.g. a language switch re-renders the widget immediately
});

ipcMain.handle('settings:save-shortcuts', (_event, shortcuts) => {
  store.saveSettings({ shortcuts });
  registerAllShortcuts();
  if (tray) tray.setContextMenu(buildTrayMenu());
  return shortcutStatus;
});

ipcMain.handle('settings:reset-shortcuts', () => {
  store.saveSettings({ shortcuts: DEFAULT_SHORTCUTS });
  registerAllShortcuts();
  if (tray) tray.setContextMenu(buildTrayMenu());
  return shortcutStatus;
});

// --- IPC: auto-tag rules (keyword-based tags on clipboard history items) ---

ipcMain.handle('settings:get-tag-rules', () => store.getTagRules());
ipcMain.handle('settings:save-tag-rules', (_event, rules) => store.saveTagRules(rules));

// --- IPC: custom action rules (user-defined pattern -> URL detectors) ---

ipcMain.handle('settings:get-custom-rules', () => store.getCustomActionRules());
ipcMain.handle('settings:save-custom-rules', (_event, rules) => store.saveCustomActionRules(rules));

ipcMain.handle('settings:get-history', () => store.getHistory());
ipcMain.on('settings:clear-history', () => store.clearHistory());
ipcMain.on('settings:clear-clipboard-history', () => {
  store.clearClipboardHistory();
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.webContents.send('history-panel:items-changed');
  }
  refreshHistorySummaries();
});

function csvEscape(value) {
  const s = String(value == null ? '' : value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildHistoryCsv(history) {
  const header = ['מספר', 'שם', 'תבנית', 'תאריך ושעה'];
  const rows = history.map((h) => [
    h.display || h.normalized,
    h.name || '',
    h.templateLabel || '',
    new Date(h.sentAt).toLocaleString('he-IL')
  ]);
  return [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n');
}

ipcMain.handle('settings:export-history-csv', async () => {
  const win = settingsWindow || BrowserWindow.getFocusedWindow();
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'ייצוא היסטוריית שליחות',
    defaultPath: `actionclip-history-${new Date().toISOString().slice(0, 10)}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  });
  if (canceled || !filePath) return { canceled: true };

  const csv = '﻿' + buildHistoryCsv(store.getHistory()); // BOM so Excel reads Hebrew correctly
  fs.writeFileSync(filePath, csv, 'utf8');
  return { canceled: false, filePath };
});

function buildLeadHistoryCsv(history) {
  const header = ['שם', 'טלפון', 'תפקיד', 'מקור', 'ערוץ', 'תאריך ושעה'];
  const rows = history.map((h) => [
    h.name || '', h.phone || '', h.role || '', h.source || '',
    h.channel || '', new Date(h.sentAt).toLocaleString('he-IL')
  ]);
  return [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n');
}

ipcMain.handle('settings:export-lead-history-csv', async () => {
  const win = settingsWindow || BrowserWindow.getFocusedWindow();
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'ייצוא היסטוריית לידים',
    defaultPath: `actionclip-leads-${new Date().toISOString().slice(0, 10)}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  });
  if (canceled || !filePath) return { canceled: true };
  const csv = '﻿' + buildLeadHistoryCsv(store.getLeadHistory());
  fs.writeFileSync(filePath, csv, 'utf8');
  return { canceled: false, filePath };
});

// Sets Windows' Startup-at-login entry to match Settings ▸ "הפעלה אוטומטית
// עם Windows", then reads it back via getLoginItemSettings() to confirm it
// actually took (round-trip verification instead of trusting the write
// blindly). Called on every app startup and every settings save, which is
// also what makes this self-healing: if the user (or Windows itself, e.g.
// via Task Manager's Startup tab, or a clean like a Windows reset) removes
// the registry entry behind the app's back, the next launch or settings
// save re-applies the stored preference rather than silently drifting out
// of sync with what Settings shows.
function applyAutoLaunch() {
  if (process.platform === 'linux') return; // not supported by Electron on Linux
  const { autoLaunch } = store.getSettings();
  app.setLoginItemSettings({ openAtLogin: autoLaunch, path: process.execPath });
  try {
    const actual = app.getLoginItemSettings({ path: process.execPath }).openAtLogin;
    if (autoLaunchNeedsReconcile({ desired: autoLaunch, actualOpenAtLogin: actual })) {
      // One retry - covers a transient failure (e.g. AV/policy blocking the
      // registry write on the first attempt). If it still doesn't match
      // after this, it's logged so it's visible in the log file rather than
      // failing silently; Settings still reflects what the user asked for.
      app.setLoginItemSettings({ openAtLogin: autoLaunch, path: process.execPath });
      const reconfirmed = app.getLoginItemSettings({ path: process.execPath }).openAtLogin;
      if (autoLaunchNeedsReconcile({ desired: autoLaunch, actualOpenAtLogin: reconfirmed })) {
        log(LOG_LEVELS.WARN, 'ActionClip: Windows Startup entry did not match the saved autoLaunch setting after retry.', { desired: autoLaunch, actual: reconfirmed });
      } else {
        log(LOG_LEVELS.INFO, 'ActionClip: Windows Startup entry re-applied to match saved setting.', { autoLaunch });
      }
    }
  } catch (err) {
    log(LOG_LEVELS.WARN, 'ActionClip: could not read back Windows Startup entry.', { message: err?.message });
  }
}

// --- App lifecycle ---

// Re-registers all three shortcuts from current settings (falling back to
// DEFAULT_SHORTCUTS for anything unset/invalid). Called on startup, after
// Settings saves a new binding, and from the tray's "רענן קיצורים" item -
// that last one matters because registration is a one-time OS grab at the
// moment it's called: if Windows still owned Win+V when the app started
// but the user turns Windows' Clipboard History off *while ActionClip is
// already running*, nothing re-tries the grab on its own until this runs
// again.
function registerAllShortcuts() {
  globalShortcut.unregisterAll();
  const configured = { ...DEFAULT_SHORTCUTS, ...(store.getSettings().shortcuts || {}) };

  shortcutStatus.manual = tryRegister(configured.manual, triggerManualPopup);
  shortcutStatus.history = tryRegister(configured.history, openHistoryWindow);
  shortcutStatus.historyFallback = tryRegister(configured.historyFallback, openHistoryWindow);

  if (!shortcutStatus.manual) {
    log(LOG_LEVELS.WARN, `ActionClip: could not register global shortcut ${configured.manual} (already taken by another app) - the tray menu item still works.`);
  }
  if (!shortcutStatus.history) {
    // Expected whenever Windows' own Clipboard History (Win+V) is still
    // turned on - Windows holds the shortcut first, so Electron can't grab
    // it. Documented in Settings; the fallback and the tray menu item still
    // work either way.
    log(LOG_LEVELS.WARN, `ActionClip: could not register ${configured.history} (likely still owned by Windows' own Clipboard History, or another app - see Settings for how to free it up).`);
  }
  if (!shortcutStatus.historyFallback) {
    log(LOG_LEVELS.WARN, `ActionClip: could not register fallback shortcut ${configured.historyFallback} - the tray menu item still works.`);
  }
}

function tryRegister(accelerator, handler) {
  if (!accelerator) return false;
  try {
    return globalShortcut.register(accelerator, handler);
  } catch (err) {
    return false; // malformed accelerator string (e.g. from bad user input)
  }
}

// ---- Auto-update (electron-updater, GitHub Releases provider) ----
// Checks ofirshudari1-ship-it/actionclip releases for a newer desktop-agent
// build. Never blocks startup and never throws past this module - a failed
// check (offline, GitHub unreachable, etc.) is logged and otherwise
// ignored, matching this app's existing tray-app failure posture.
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function initAutoUpdater() {
  if (!app.isPackaged) return; // no packaged app.asar / no update feed in dev

  autoUpdater.on('error', (err) => {
    log(LOG_LEVELS.ERROR, 'autoUpdater error', { message: err?.message || String(err) });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log(LOG_LEVELS.INFO, 'autoUpdater update downloaded', { version: info?.version });
    dialog
      .showMessageBox({
        type: 'info',
        title: 'ActionClip Update Ready',
        message: `ActionClip ${info.version} has been downloaded.`,
        detail: 'Restart now to install the update, or it will install automatically the next time you quit ActionClip.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      })
      .catch((err) => log(LOG_LEVELS.ERROR, 'autoUpdater dialog failed', { message: err?.message }));
  });

  try {
    autoUpdater.checkForUpdatesAndNotify();
  } catch (err) {
    log(LOG_LEVELS.ERROR, 'autoUpdater checkForUpdatesAndNotify threw', { message: err?.message });
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  // Another instance already owns the lock (tray icon, clipboard watcher,
  // global shortcuts) - quitting immediately here is what actually
  // prevents duplicates; without this, every launch (auto-start, a second
  // double-click of the installed shortcut, etc.) added its own full
  // instance, each with its own tray icon and clipboard-poll timer.
  app.quit();
} else {
  app.on('second-instance', () => {
    // Something tried to launch a second copy - surface the existing
    // instance's settings window instead of silently doing nothing.
    openSettingsWindow();
  });

  // Catch-all for every quit path, not just the tray's "יציאה" item -
  // autoUpdater.quitAndInstall(), a future Cmd/Alt+Q, etc. all fire
  // 'before-quit' too, and shouldHideToTray needs isQuitting set before any
  // window's 'close' handler runs so it doesn't intercept a real quit.
  app.on('before-quit', () => { isQuitting = true; });

  app.whenReady().then(() => {
    createTray();
    // Shared/work-PC option: force monitoring off at this specific launch
    // regardless of whatever `enabled` was left at last time, without
    // changing the user's actual saved preference for next time... except it
    // IS the saved preference (there's no separate "session-only" state in
    // this store), so this intentionally persists enabled:false until the
    // user turns monitoring back on themselves - that's the point of
    // "start paused" for a machine other people also use.
    const startupSettings = store.getSettings();
    if (startupSettings.startPaused && startupSettings.enabled) {
      store.saveSettings({ enabled: false });
    }
    startClipboardWatcher();
    applyAutoLaunch();
    registerAllShortcuts();
    applyWidgetVisibility(); // persistent widget - on by default, see widgetEnabled
    const { startMinimized } = store.getSettings();
    if (!startMinimized) {
      maybeShowWelcome();
    }
    // Non-blocking; give the tray/clipboard-watcher startup a few seconds
    // to settle before hitting the network.
    setTimeout(initAutoUpdater, 5000);
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });
}

// Tray app: subscribing here (without calling app.quit()) is what keeps the
// process alive on Windows/Linux once the popup/settings windows close.
app.on('window-all-closed', () => {});
