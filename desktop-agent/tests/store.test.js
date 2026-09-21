// store.test.js — tests for src/lib/store.js using the in-memory Store mock.

// Reset module registry between tests so each test gets a fresh store.
beforeEach(() => { jest.resetModules(); });

function freshStore() {
  return require('../src/lib/store');
}

// ─── getSettings / saveSettings ───────────────────────────────────────────────

describe('getSettings / saveSettings', () => {
  test('returns defaults on first call', () => {
    const store = freshStore();
    const s = store.getSettings();
    expect(s.enabled).toBe(true);
    expect(s.pollMs).toBe(800);
    expect(s.detectors.phone).toBe(true);
    expect(s.detectors.tracking).toBe(true);
  });

  test('merges partial settings — does not wipe keys not in payload', () => {
    const store = freshStore();
    store.saveSettings({ pollMs: 1200 });
    const s = store.getSettings();
    expect(s.pollMs).toBe(1200);
    expect(s.enabled).toBe(true); // untouched
  });

  test('merges detectors deep — does not wipe other detector keys', () => {
    const store = freshStore();
    store.saveSettings({ detectors: { phone: false } });
    const s = store.getSettings();
    expect(s.detectors.phone).toBe(false);
    expect(s.detectors.tracking).toBe(true); // untouched
  });

  test('quietHours defaults to disabled with a sensible overnight window', () => {
    const store = freshStore();
    const s = store.getSettings();
    expect(s.quietHours.enabled).toBe(false);
    expect(s.quietHours.start).toBe('18:00');
    expect(s.quietHours.end).toBe('08:00');
  });

  test('merges quietHours deep — does not wipe other quietHours keys', () => {
    const store = freshStore();
    store.saveSettings({ quietHours: { enabled: true } });
    const s = store.getSettings();
    expect(s.quietHours.enabled).toBe(true);
    expect(s.quietHours.start).toBe('18:00'); // untouched
  });

  test('soundOnDetect defaults to false', () => {
    const store = freshStore();
    expect(store.getSettings().soundOnDetect).toBe(false);
  });

  test('closeToTray defaults to true (X hides to tray, not full quit)', () => {
    const store = freshStore();
    expect(store.getSettings().closeToTray).toBe(true);
  });

  test('trayClickAction defaults to history, trayHideHintSeen defaults to false, startPaused defaults to false', () => {
    const store = freshStore();
    const s = store.getSettings();
    expect(s.trayClickAction).toBe('history');
    expect(s.trayHideHintSeen).toBe(false);
    expect(s.startPaused).toBe(false);
  });

  test('saves and retrieves trayClickAction / startPaused without wiping other keys', () => {
    const store = freshStore();
    store.saveSettings({ trayClickAction: 'settings', startPaused: true });
    const s = store.getSettings();
    expect(s.trayClickAction).toBe('settings');
    expect(s.startPaused).toBe(true);
    expect(s.closeToTray).toBe(true); // untouched
  });

  test('trayHideHintSeen flips and stays true once saved', () => {
    const store = freshStore();
    store.saveSettings({ trayHideHintSeen: true });
    expect(store.getSettings().trayHideHintSeen).toBe(true);
  });

  test('widgetEnabled defaults to true, widgetPosition defaults to null', () => {
    const store = freshStore();
    const s = store.getSettings();
    expect(s.widgetEnabled).toBe(true);
    expect(s.widgetPosition).toBeNull();
  });

  test('saves and retrieves widgetEnabled without wiping other keys', () => {
    const store = freshStore();
    store.saveSettings({ widgetEnabled: false });
    const s = store.getSettings();
    expect(s.widgetEnabled).toBe(false);
    expect(s.closeToTray).toBe(true); // untouched
  });

  test('widgetEnabled persists across separate getSettings() calls (survives "restart")', () => {
    const store = freshStore();
    store.saveSettings({ widgetEnabled: false });
    expect(store.getSettings().widgetEnabled).toBe(false);
    expect(store.getSettings().widgetEnabled).toBe(false);
  });

  test('saves and retrieves widgetPosition', () => {
    const store = freshStore();
    store.saveSettings({ widgetPosition: { x: 120, y: 340 } });
    const s = store.getSettings();
    expect(s.widgetPosition).toEqual({ x: 120, y: 340 });
    expect(s.widgetEnabled).toBe(true); // untouched
  });
});

// ─── getLeadSettings / saveLeadSettings ───────────────────────────────────────

describe('getLeadSettings / saveLeadSettings', () => {
  test('returns defaults', () => {
    const store = freshStore();
    const ls = store.getLeadSettings();
    expect(ls.duplicateWindowHours).toBe(6);
    expect(ls.channelWhatsapp).toBe(true);
    expect(Array.isArray(ls.customSources)).toBe(true);
  });

  test('saves and retrieves partial updates', () => {
    const store = freshStore();
    store.saveLeadSettings({ webhookUrl: 'https://hook.example.com', channelWebhook: true });
    const ls = store.getLeadSettings();
    expect(ls.webhookUrl).toBe('https://hook.example.com');
    expect(ls.channelWebhook).toBe(true);
    expect(ls.channelWhatsapp).toBe(true); // untouched
  });
});

// ─── Lead history ─────────────────────────────────────────────────────────────

describe('lead history', () => {
  test('starts empty', () => {
    const store = freshStore();
    expect(store.getLeadHistory()).toEqual([]);
  });

  test('addLeadHistoryEntry prepends and returns all', () => {
    const store = freshStore();
    store.addLeadHistoryEntry({ name: 'אלי', phone: '0501111111' });
    store.addLeadHistoryEntry({ name: 'שרה', phone: '0502222222' });
    const history = store.getLeadHistory();
    expect(history[0].name).toBe('שרה'); // newest first
    expect(history[1].name).toBe('אלי');
  });

  test('clears lead history', () => {
    const store = freshStore();
    store.addLeadHistoryEntry({ name: 'רון', phone: '0503333333' });
    store.clearLeadHistory();
    expect(store.getLeadHistory()).toEqual([]);
  });

  test('respects LEAD_HISTORY_LIMIT (50)', () => {
    const store = freshStore();
    for (let i = 0; i < 60; i++) {
      store.addLeadHistoryEntry({ name: `Lead ${i}`, phone: `05000${String(i).padStart(5, '0')}` });
    }
    expect(store.getLeadHistory().length).toBe(50);
  });
});

// ─── findRecentLeadSend ───────────────────────────────────────────────────────

describe('findRecentLeadSend', () => {
  test('finds recent send by phone', () => {
    const store = freshStore();
    store.addLeadHistoryEntry({ name: 'דן', phone: '050-111-2222' });
    const found = store.findRecentLeadSend({ phone: '0501112222' }, 6);
    expect(found).not.toBeNull();
    expect(found.name).toBe('דן');
  });

  test('finds entry within window, misses entry outside window', () => {
    const store = freshStore();
    store.addLeadHistoryEntry({ name: 'חדש', phone: '050-888-8888' });
    // window=6h → just-added entry is within → found
    expect(store.findRecentLeadSend({ phone: '0508888888' }, 6)).not.toBeNull();
    // completely different phone → not found regardless of window
    expect(store.findRecentLeadSend({ phone: '0501111111' }, 6)).toBeNull();
  });

  test('returns null when phone not in history', () => {
    const store = freshStore();
    store.addLeadHistoryEntry({ name: 'מישהו', phone: '050-777-7777' });
    const notFound = store.findRecentLeadSend({ phone: '052-111-2222' }, 6);
    expect(notFound).toBeNull();
  });

  test('matches by name when no phone', () => {
    const store = freshStore();
    store.addLeadHistoryEntry({ name: 'מיכל כהן', phone: '' });
    const found = store.findRecentLeadSend({ name: 'מיכל כהן', phone: '' }, 6);
    expect(found).not.toBeNull();
  });
});

// ─── computeTags / saveTagRules ───────────────────────────────────────────────

describe('computeTags', () => {
  test('matches keywords case-insensitively', () => {
    const store = freshStore();
    store.saveTagRules([{ label: 'פרויקט X', keywords: ['פרויקט', 'project'] }]);
    expect(store.computeTags('נושא הפרויקט שלנו')).toEqual(['פרויקט X']);
    expect(store.computeTags('Our project update')).toEqual(['פרויקט X']);
  });

  test('returns empty array when no match', () => {
    const store = freshStore();
    store.saveTagRules([{ label: 'מכירות', keywords: ['sale', 'עסקה'] }]);
    expect(store.computeTags('שלום עולם')).toEqual([]);
  });

  test('matches multiple rules', () => {
    const store = freshStore();
    store.saveTagRules([
      { label: 'A', keywords: ['foo'] },
      { label: 'B', keywords: ['bar'] }
    ]);
    expect(store.computeTags('foo and bar')).toEqual(['A', 'B']);
  });

  test('returns empty for empty text', () => {
    const store = freshStore();
    store.saveTagRules([{ label: 'T', keywords: ['x'] }]);
    expect(store.computeTags('')).toEqual([]);
    expect(store.computeTags(null)).toEqual([]);
  });
});

// ─── templates ────────────────────────────────────────────────────────────────

describe('templates', () => {
  test('returns default templates', () => {
    const store = freshStore();
    const templates = store.getTemplates();
    expect(templates.length).toBeGreaterThan(0);
    expect(templates[0]).toHaveProperty('id');
    expect(templates[0]).toHaveProperty('label');
    expect(templates[0]).toHaveProperty('text');
  });

  test('saveTemplates and retrieve', () => {
    const store = freshStore();
    const custom = [{ id: 'c1', label: 'בדיקה', text: 'שלום {שם}' }];
    store.saveTemplates(custom, 'c1');
    expect(store.getTemplates()).toEqual(custom);
    expect(store.getDefaultTemplateId()).toBe('c1');
  });

  test('resetTemplates restores defaults', () => {
    const store = freshStore();
    store.saveTemplates([{ id: 'x', label: 'X', text: 'X' }], 'x');
    store.resetTemplates();
    expect(store.getTemplates().length).toBeGreaterThan(1);
  });
});

// ─── WhatsApp send history ────────────────────────────────────────────────────

describe('send history (WhatsApp)', () => {
  test('addHistoryEntry and getHistory', () => {
    const store = freshStore();
    store.addHistoryEntry({ normalized: '972501234567', display: '050-1234567', name: 'ג׳ון', templateLabel: 'ליד חדש' });
    const h = store.getHistory();
    expect(h.length).toBe(1);
    expect(h[0].name).toBe('ג׳ון');
  });

  test('findRecentSend finds entry within window', () => {
    const store = freshStore();
    store.addHistoryEntry({ normalized: '972501234567', display: '050-1234567', name: 'test', templateLabel: '' });
    const found = store.findRecentSend('972501234567', 30);
    expect(found).not.toBeNull();
  });

  test('findRecentSend misses different number', () => {
    const store = freshStore();
    store.addHistoryEntry({ normalized: '972501234567', display: '050-1234567', name: 'test', templateLabel: '' });
    expect(store.findRecentSend('972529999999', 30)).toBeNull();
  });

  test('clearHistory empties list', () => {
    const store = freshStore();
    store.addHistoryEntry({ normalized: '972501234567', display: '050-1234567', name: 'x', templateLabel: '' });
    store.clearHistory();
    expect(store.getHistory()).toEqual([]);
  });
});
