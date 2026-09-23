// window-behavior.test.js — tests for src/lib/window-behavior.js, the pure
// helpers behind the tray app's close-to-tray/quit split and auto-launch
// self-heal logic.

const {
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

describe('resolveWidgetPosition', () => {
  const primary = { x: 0, y: 0, width: 1920, height: 1040 };
  const second = { x: 1920, y: 0, width: 1920, height: 1040 };
  const size = { width: 240, height: 156 };

  test('keeps a saved position that is still on a connected display', () => {
    expect(resolveWidgetPosition({ saved: { x: 100, y: 200 }, workAreas: [primary], ...size }))
      .toEqual({ x: 100, y: 200 });
  });

  test('returns null (-> default corner) when the saved monitor is gone', () => {
    // Saved on the second monitor, which is now unplugged.
    expect(resolveWidgetPosition({ saved: { x: 2500, y: 300 }, workAreas: [primary], ...size })).toBeNull();
  });

  test('still honors the second monitor while it is connected', () => {
    expect(resolveWidgetPosition({ saved: { x: 2500, y: 300 }, workAreas: [primary, second], ...size }))
      .toEqual({ x: 2500, y: 300 });
  });

  test('clamps a partly-off-screen position back inside the work area', () => {
    // e.g. resolution dropped: center still on screen, bottom-right hangs off.
    expect(resolveWidgetPosition({ saved: { x: 1750, y: 950 }, workAreas: [primary], ...size }))
      .toEqual({ x: 1920 - 240, y: 1040 - 156 });
  });

  test('returns null for missing or malformed saved data', () => {
    expect(resolveWidgetPosition({ saved: null, workAreas: [primary], ...size })).toBeNull();
    expect(resolveWidgetPosition({ saved: { x: 'a', y: 1 }, workAreas: [primary], ...size })).toBeNull();
    expect(resolveWidgetPosition({ saved: { x: 10, y: 10 }, workAreas: [], ...size })).toBeNull();
  });
});

describe('buildWidgetState — privacy boundary of the always-visible widget', () => {
  const recentItem = {
    id: '1',
    text: '050-123-4567 secret note',
    category: 'phone',
    actions: [{ label: 'WhatsApp: 050-123-4567', url: 'https://wa.me/972501234567' }],
    tags: ['client-x'],
    copiedAt: 1700000000000
  };

  test('passes through only state, language, category and timestamp', () => {
    expect(buildWidgetState({ settings: { enabled: true, language: 'he' }, recentItem })).toEqual({
      enabled: true,
      language: 'he',
      recent: { category: 'phone', copiedAt: 1700000000000 }
    });
  });

  test('never leaks the copied text, action labels/URLs or tags anywhere in the payload', () => {
    const json = JSON.stringify(buildWidgetState({ settings: { enabled: true }, recentItem }));
    expect(json).not.toMatch(/050|4567|secret|wa\.me|WhatsApp|client-x/);
  });

  test('reports paused state and null recent when there is nothing to show', () => {
    expect(buildWidgetState({ settings: { enabled: false }, recentItem: null }))
      .toEqual({ enabled: false, language: 'en', recent: null });
  });

  test('defaults to English for a missing/unknown language (STANDARDS §4)', () => {
    expect(buildWidgetState({ settings: { language: 'xx' }, recentItem: null }).language).toBe('en');
  });
});

describe('shouldPrimeClipboardOnResume', () => {
  test('primes only on a paused -> active transition', () => {
    expect(shouldPrimeClipboardOnResume({ wasEnabled: false, willBeEnabled: true })).toBe(true);
  });

  test('does not prime when already active, when pausing, or when staying paused', () => {
    expect(shouldPrimeClipboardOnResume({ wasEnabled: true, willBeEnabled: true })).toBe(false);
    expect(shouldPrimeClipboardOnResume({ wasEnabled: true, willBeEnabled: false })).toBe(false);
    expect(shouldPrimeClipboardOnResume({ wasEnabled: false, willBeEnabled: false })).toBe(false);
  });
});

describe('timeAgoBucket', () => {
  const now = 10_000_000_000;
  test('buckets into now / minutes / hours / days', () => {
    expect(timeAgoBucket(now - 10_000, now)).toEqual({ unit: 'now', n: 0 });
    expect(timeAgoBucket(now - 5 * 60_000, now)).toEqual({ unit: 'min', n: 5 });
    expect(timeAgoBucket(now - 3 * 3_600_000, now)).toEqual({ unit: 'hour', n: 3 });
    expect(timeAgoBucket(now - 2 * 86_400_000, now)).toEqual({ unit: 'day', n: 2 });
  });

  test('never goes negative for a timestamp slightly in the future (clock skew)', () => {
    expect(timeAgoBucket(now + 60_000, now)).toEqual({ unit: 'now', n: 0 });
  });
});
