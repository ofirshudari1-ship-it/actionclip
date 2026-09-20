// window-behavior.test.js — tests for src/lib/window-behavior.js, the pure
// helpers behind the tray app's close-to-tray/quit split and auto-launch
// self-heal logic.

const {
  shouldHideToTray,
  shouldShowTrayHideHint,
  autoLaunchNeedsReconcile,
  resolveTrayClickTarget
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
