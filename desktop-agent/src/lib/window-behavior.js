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

module.exports = {
  shouldHideToTray,
  shouldShowTrayHideHint,
  autoLaunchNeedsReconcile,
  resolveTrayClickTarget,
  resolveWidgetVisibility,
  widgetDefaultPosition
};
