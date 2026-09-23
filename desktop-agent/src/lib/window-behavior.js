// window-behavior.js — small pure helpers for the tray-app close/quit and
// auto-launch decisions in main.js. Kept side-effect-free and separate from
// main.js so they're unit-testable without mocking Electron's Tray/
// BrowserWindow/app APIs.

// Decides whether a window's 'close' event should be intercepted (hidden to
// tray) instead of allowed to actually close/destroy the window.
//
// The critical bit is `isQuitting`: Electron's app.quit() closes every open
// BrowserWindow by firing its 'close' event, exactly like the user clicking
// the window's own X button. If a window's close handler unconditionally
// calls event.preventDefault() whenever closeToTray is on, then clicking
// "Exit" in the tray menu (which calls app.quit()) would hit that same
// handler, prevent the window from closing, and per Electron's documented
// behavior that cancels the whole quit — "Exit" would silently do nothing
// while the Settings window is open. Callers must set `isQuitting = true`
// before calling app.quit() (and in a 'before-quit' handler, as a catch-all
// for other quit paths like autoUpdater.quitAndInstall()) so this returns
// false during an actual quit, letting the window close for real.
function shouldHideToTray({ closeToTray, isQuitting, hasTray }) {
  return closeToTray !== false && !isQuitting && !!hasTray;
}

// One-time explainer: the first time a window is hidden (not closed) to the
// tray, show a tray balloon so the user isn't left wondering where the app
// went — this directly targets the "confusing scenario" this app's two
// meanings of 'close' can create. Never nags again once seen, and is itself
// gated by the existing showTrayNotification toggle (Settings already lets
// the user opt out of all tray balloons).
function shouldShowTrayHideHint({ hideHintSeen, showTrayNotification }) {
  return hideHintSeen !== true && showTrayNotification !== false;
}

// True when the OS's actual login-item state doesn't match what the user
// asked for in Settings (e.g. the user or Windows removed the Startup entry
// by hand outside the app). Used to log + re-apply ("self-heal") rather than
// silently trusting the value written on the last save.
function autoLaunchNeedsReconcile({ desired, actualOpenAtLogin }) {
  return !!desired !== !!actualOpenAtLogin;
}

// Tray icon left-click routing. `action` is the settings.trayClickAction
// value ('history' | 'settings' | 'none' | anything else falls back to
// 'history', the historical/default behavior of a single click doing
// nothing useful being worse than opening the most commonly-needed panel).
function resolveTrayClickTarget(action) {
  if (action === 'settings') return 'settings';
  if (action === 'none') return 'none';
  return 'history';
}

// Desktop widget: shown at startup, and live-toggled from Settings, purely
// off the persisted `widgetEnabled` flag — defaults ON (undefined/anything
// but an explicit `false` shows it), matching every other "on by default"
// toggle in this store (see DEFAULT_SETTINGS in lib/store.js).
function resolveWidgetVisibility({ widgetEnabled }) {
  return widgetEnabled !== false;
}

// Default corner for the widget the first time it's ever shown (no saved
// `widgetPosition` yet): bottom-right of the given work area, inset by
// `margin` so it never touches the screen edge or the taskbar.
function widgetDefaultPosition({ workArea, width, height, margin = 24 }) {
  return {
    x: workArea.x + workArea.width - width - margin,
    y: workArea.y + workArea.height - height - margin
  };
}

// Validates a saved widget position against the displays that exist *now*
// (STANDARDS.md §12.3): a position saved while a second monitor was attached
// would otherwise reopen the widget entirely off-screen - invisible, with no
// way to drag it back - after that monitor is disconnected or the resolution
// changes. Keeps the saved spot if the widget's center still lands inside
// some work area (clamped so no edge hangs off that work area); otherwise
// returns null so the caller falls back to widgetDefaultPosition.
function resolveWidgetPosition({ saved, workAreas, width, height }) {
  if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return null;
  const cx = saved.x + width / 2;
  const cy = saved.y + height / 2;
  const area = (workAreas || []).find((wa) =>
    cx >= wa.x && cx < wa.x + wa.width && cy >= wa.y && cy < wa.y + wa.height);
  if (!area) return null;
  const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));
  return {
    x: clamp(saved.x, area.x, area.x + area.width - width),
    y: clamp(saved.y, area.y, area.y + area.height - height)
  };
}

// Builds the ONLY payload the always-visible desktop widget ever receives.
// Privacy boundary: the widget sits on the desktop where anyone walking past
// can read it, so this deliberately copies over an allowlist of fields -
// monitoring state, UI language, and the *category* + timestamp of the most
// recent detected action - and never the history item's `text`, `actions`
// (whose labels/URLs embed the copied value, e.g. "WhatsApp: 050-..."), or
// `tags`. Kept pure so tests can assert that guarantee directly.
function buildWidgetState({ settings, recentItem }) {
  const s = settings || {};
  return {
    enabled: s.enabled !== false,
    language: s.language === 'he' ? 'he' : 'en',
    recent: recentItem && recentItem.category
      ? { category: String(recentItem.category), copiedAt: Number(recentItem.copiedAt) || 0 }
      : null
  };
}

// Resuming monitoring must not retroactively capture whatever was copied
// while it was paused (the whole point of pausing - e.g. to copy a password
// or anything private). The poll loop skips reading the clipboard entirely
// while paused, so without a fresh baseline the first tick after resume
// would see "new" text and log it to the on-disk history / pop a popup for
// it. True exactly on a paused -> active transition.
function shouldPrimeClipboardOnResume({ wasEnabled, willBeEnabled }) {
  return wasEnabled === false && willBeEnabled === true;
}

// "X ago" bucket for the widget's recent-action row. Returns a unit + count
// so the renderer can pick the right localized string.
function timeAgoBucket(timestamp, now = Date.now()) {
  const mins = Math.max(0, Math.round((now - timestamp) / 60000));
  if (mins < 1) return { unit: 'now', n: 0 };
  if (mins < 60) return { unit: 'min', n: mins };
  const hours = Math.round(mins / 60);
  if (hours < 24) return { unit: 'hour', n: hours };
  return { unit: 'day', n: Math.round(hours / 24) };
}

// Same dual-export pattern as lib/i18n-renderer.js: CommonJS for main.js and
// Jest, and a window global for the sandboxed widget renderer, which loads
// this file via <script> (no require/bundler there) to share timeAgoBucket.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    shouldHideToTray,
    shouldShowTrayHideHint,
    autoLaunchNeedsReconcile,
    resolveTrayClickTarget,
    resolveWidgetVisibility,
    widgetDefaultPosition,
    resolveWidgetPosition,
    buildWidgetState,
    shouldPrimeClipboardOnResume,
    timeAgoBucket
  };
} else if (typeof window !== 'undefined') {
  window.actionclipWindowBehavior = { timeAgoBucket };
}
