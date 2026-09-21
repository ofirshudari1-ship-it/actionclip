// window-behavior.test.js — tests for src/lib/window-behavior.js, the pure
// helpers behind the tray app's close-to-tray/quit split and auto-launch
// self-heal logic.

const {
  shouldHideToTray,
  shouldShowTrayHideHint,
  autoLaunchNeedsReconcile,
  resolveTrayClickTarget,
  resolveWidgetVisibility,
  widgetDefaultPosition
} = require('../src/lib/window-behavior');

describe('shouldHideToTray', () => {
  test('hides when closeToTray is on, not quitting, and tray exists', () => {
    expect(shouldHideToTray({ closeToTray: true, isQuitting: false, hasTray: true })).toBe(true);
  });

  test('closeToTray defaults on when undefined (only explicit false disables it)', () => {
    expect(shouldHideToTray({ closeToTray: undefined, isQuitting: false, hasTray: true })).toBe(true);
  });

  test('does not hide when closeToTray is explicitly false', () => {
    expect(shouldHideToTray({ closeToTray: false, isQuitting: false, hasTray: true })).toBe(false);
  });

  test('does not hide while an actual quit is in progress — this is the "יציאה" bug fix', () => {
    // Regression guard: before this flag existed, clicking the tray's
    // "יציאה" item while the Settings window was open would hit the same
    // interception as the window's own X button, preventDefault() the
    // window's close, and per Electron's documented behavior that silently
    // cancels app.quit() entirely.
    expect(shouldHideToTray({ closeToTray: true, isQuitting: true, hasTray: true })).toBe(false);
  });

  test('does not hide when there is no tray to hide to', () => {
    expect(shouldHideToTray({ closeToTray: true, isQuitting: false, hasTray: false })).toBe(false);
  });
});

describe('shouldShowTrayHideHint', () => {
  test('shows the hint the first time (hideHintSeen unset)', () => {
    expect(shouldShowTrayHideHint({ hideHintSeen: false, showTrayNotification: true })).toBe(true);
  });

  test('never shows again once seen', () => {
    expect(shouldShowTrayHideHint({ hideHintSeen: true, showTrayNotification: true })).toBe(false);
  });

  test('respects the existing tray-notification opt-out', () => {
    expect(shouldShowTrayHideHint({ hideHintSeen: false, showTrayNotification: false })).toBe(false);
  });
});

describe('autoLaunchNeedsReconcile', () => {
  test('false when OS state already matches desired state', () => {
    expect(autoLaunchNeedsReconcile({ desired: true, actualOpenAtLogin: true })).toBe(false);
    expect(autoLaunchNeedsReconcile({ desired: false, actualOpenAtLogin: false })).toBe(false);
  });

  test('true when the user (or Windows) removed the Startup entry behind the app\'s back', () => {
    expect(autoLaunchNeedsReconcile({ desired: true, actualOpenAtLogin: false })).toBe(true);
  });

  test('true when the OS has it enabled but the saved setting turned it off', () => {
    expect(autoLaunchNeedsReconcile({ desired: false, actualOpenAtLogin: true })).toBe(true);
  });
});

describe('resolveTrayClickTarget', () => {
  test('maps settings values to their targets', () => {
    expect(resolveTrayClickTarget('history')).toBe('history');
    expect(resolveTrayClickTarget('settings')).toBe('settings');
    expect(resolveTrayClickTarget('none')).toBe('none');
  });

  test('falls back to history for unset/unknown values', () => {
    expect(resolveTrayClickTarget(undefined)).toBe('history');
    expect(resolveTrayClickTarget('bogus')).toBe('history');
  });
});

describe('resolveWidgetVisibility', () => {
  test('shows the widget by default (on) when unset', () => {
    expect(resolveWidgetVisibility({ widgetEnabled: undefined })).toBe(true);
  });

  test('shows the widget when explicitly enabled', () => {
    expect(resolveWidgetVisibility({ widgetEnabled: true })).toBe(true);
  });

  test('hides the widget only when explicitly disabled', () => {
    expect(resolveWidgetVisibility({ widgetEnabled: false })).toBe(false);
  });
});

describe('widgetDefaultPosition', () => {
  test('anchors to the bottom-right corner of the work area, inset by the margin', () => {
    const workArea = { x: 0, y: 0, width: 1920, height: 1080 };
    const pos = widgetDefaultPosition({ workArea, width: 240, height: 156, margin: 24 });
    expect(pos).toEqual({ x: 1920 - 240 - 24, y: 1080 - 156 - 24 });
  });

  test('accounts for a non-zero work area origin (e.g. a taskbar on the left/top monitor)', () => {
    const workArea = { x: 100, y: 50, width: 1600, height: 900 };
    const pos = widgetDefaultPosition({ workArea, width: 240, height: 156, margin: 24 });
    expect(pos).toEqual({ x: 100 + 1600 - 240 - 24, y: 50 + 900 - 156 - 24 });
  });

  test('defaults margin to 24 when not provided', () => {
    const workArea = { x: 0, y: 0, width: 1000, height: 800 };
    const pos = widgetDefaultPosition({ workArea, width: 200, height: 100 });
    expect(pos).toEqual({ x: 1000 - 200 - 24, y: 800 - 100 - 24 });
  });
});
