// diagnostics.test.js — redaction rules for the diagnostics export (Settings
// ▸ About ▸ "ייצוא קובץ אבחון"). TapAct handles real personal data (lead
// names/phones, clipboard contents, message templates); this bundle must
// never carry any of it or any secret capable of sending on the user's
// behalf. These tests lock in exactly which fields get stripped.

const { buildRedactedSettingsSnapshot, buildSystemInfoText, REDACTED } = require('../src/lib/diagnostics');

function sampleRaw(overrides = {}) {
  return {
    settings: { enabled: true, language: 'he', theme: 'dark', pollMs: 800 },
    leadSettings: {
      webhookUrl: 'https://hooks.example.com/secret-abc',
      webhookHeaderName: 'X-Auth',
      webhookHeaderValue: 'super-secret-token',
      channelWebhook: true,
      channelWhatsapp: true,
      whatsappNumber: '0501234567',
      channelEmail: false,
      emailAddress: 'lead@example.com',
      channelSlack: true,
      slackWebhookUrl: 'https://hooks.slack.com/services/T00/B00/XXXX',
      channelCopy: false,
      messageTemplate: 'היי {שם}, זה ליד אמיתי עם פרטים רגישים',
      aiEnabled: true,
      aiApiKey: 'sk-real-api-key-12345',
      customSources: ['TikTok', 'YouTube'],
      duplicateWindowHours: 6
    },
    templates: [{ id: 'a' }, { id: 'b' }],
    history: [{ id: 1 }],
    clipboardHistory: [{ id: 1 }, { id: 2 }, { id: 3 }],
    leadHistory: [{ id: 1 }, { id: 2 }],
    tagRules: [{ id: 1 }],
    customActionRules: [],
    ...overrides
  };
}

describe('buildRedactedSettingsSnapshot', () => {
  test('redacts every secret capable of sending on the user\'s behalf', () => {
    const out = buildRedactedSettingsSnapshot(sampleRaw());
    expect(out.leadSettings.webhookUrl).toBe(REDACTED);
    expect(out.leadSettings.webhookHeaderValue).toBe(REDACTED);
    expect(out.leadSettings.slackWebhookUrl).toBe(REDACTED);
    expect(out.leadSettings.aiApiKey).toBe(REDACTED);
  });

  test('redacts personal data: phone number, email address, message template, header name', () => {
    const out = buildRedactedSettingsSnapshot(sampleRaw());
    expect(out.leadSettings.whatsappNumber).toBe(REDACTED);
    expect(out.leadSettings.emailAddress).toBe(REDACTED);
    expect(out.leadSettings.messageTemplate).toBe(REDACTED);
    expect(out.leadSettings.webhookHeaderName).toBe(REDACTED);
    // The raw phone number / secret text must not appear anywhere in the output.
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('0501234567');
    expect(serialized).not.toContain('lead@example.com');
    expect(serialized).not.toContain('super-secret-token');
    expect(serialized).not.toContain('sk-real-api-key-12345');
    expect(serialized).not.toContain('פרטים רגישים');
  });

  test('unset secret/personal fields are labeled "(not set)" rather than redacted-looking', () => {
    const raw = sampleRaw();
    raw.leadSettings.webhookUrl = '';
    raw.leadSettings.aiApiKey = '';
    const out = buildRedactedSettingsSnapshot(raw);
    expect(out.leadSettings.webhookUrl).toBe('(not set)');
    expect(out.leadSettings.aiApiKey).toBe('(not set)');
  });

  test('keeps structural/technical fields untouched', () => {
    const out = buildRedactedSettingsSnapshot(sampleRaw());
    expect(out.leadSettings.channelWebhook).toBe(true);
    expect(out.leadSettings.channelWhatsapp).toBe(true);
    expect(out.leadSettings.channelSlack).toBe(true);
    expect(out.leadSettings.duplicateWindowHours).toBe(6);
    expect(out.leadSettings.customSources).toEqual(['TikTok', 'YouTube']);
    expect(out.settings).toEqual({ enabled: true, language: 'he', theme: 'dark', pollMs: 800 });
  });

  test('never includes actual content for clipboard/lead/send history or templates - only counts', () => {
    const out = buildRedactedSettingsSnapshot(sampleRaw());
    expect(out.dataCounts).toEqual({
      templates: 2,
      history: 1,
      clipboardHistory: 3,
      leadHistory: 2,
      tagRules: 1,
      customActionRules: 0
    });
    expect(out).not.toHaveProperty('templates');
    expect(out).not.toHaveProperty('clipboardHistory');
    expect(out).not.toHaveProperty('leadHistory');
    expect(out).not.toHaveProperty('history');
  });

  test('tolerates missing/empty input without throwing', () => {
    expect(() => buildRedactedSettingsSnapshot({})).not.toThrow();
    const out = buildRedactedSettingsSnapshot({});
    expect(out.dataCounts).toEqual({
      templates: 0, history: 0, clipboardHistory: 0, leadHistory: 0, tagRules: 0, customActionRules: 0
    });
  });
});

describe('buildSystemInfoText', () => {
  test('includes the given technical fields and no personal data', () => {
    const text = buildSystemInfoText({
      osType: 'Windows_NT 10.0.26340',
      osArch: 'x64',
      electronVersion: '44.0.0',
      chromeVersion: '128.0.0.0',
      nodeVersion: '20.0.0',
      appVersion: '3.4.0',
      buildDate: '2026-09-25',
      installPath: 'C:\\Program Files\\TapAct'
    });
    expect(text).toContain('3.4.0');
    expect(text).toContain('Windows_NT 10.0.26340');
    expect(text).toContain('x64');
    expect(text).toContain('44.0.0');
    expect(text).toContain('128.0.0.0');
    expect(text).toContain('C:\\Program Files\\TapAct');
  });

  test('falls back to "unknown" for missing fields instead of throwing', () => {
    expect(() => buildSystemInfoText({})).not.toThrow();
    expect(buildSystemInfoText({})).toContain('unknown');
  });
});
