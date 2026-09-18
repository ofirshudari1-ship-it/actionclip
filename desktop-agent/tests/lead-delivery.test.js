// lead-delivery.test.js
// Tests for pure functions in src/lib/lead-delivery.js.
// postJson and cleanupLeadWithAi use electron.net — mocked below.

const { buildShareText, buildWhatsappUrl, buildMailtoUrl, postJson } = require('../src/lib/lead-delivery');
const electronMock = require('./__mocks__/electron');

const SAMPLE_LEAD = { name: 'דוד לוי', phone: '050-123-4567', role: 'מנהל', source: 'פייסבוק' };

// ─── renderTemplate / buildShareText ──────────────────────────────────────────

describe('buildShareText', () => {
  test('default Hebrew text when no template', () => {
    const text = buildShareText(SAMPLE_LEAD, '');
    expect(text).toContain('ליד חדש');
    expect(text).toContain('דוד לוי');
    expect(text).toContain('050-123-4567');
    expect(text).toContain('מנהל');
    expect(text).toContain('פייסבוק');
  });

  test('renders custom template with {{tokens}}', () => {
    const template = 'שם: {{name}}, טל: {{phone}}, תפקיד: {{role}}';
    const text = buildShareText(SAMPLE_LEAD, template);
    expect(text).toBe('שם: דוד לוי, טל: 050-123-4567, תפקיד: מנהל');
  });

  test('missing field renders as dash', () => {
    const text = buildShareText({ name: 'רון' }, '{{name}} / {{phone}} / {{role}}');
    expect(text).toBe('רון / - / -');
  });

  test('includes url if present', () => {
    const text = buildShareText({ ...SAMPLE_LEAD, url: 'https://example.com' }, '');
    expect(text).toContain('https://example.com');
  });

  test('no url field — no line added', () => {
    const text = buildShareText(SAMPLE_LEAD, '');
    expect(text).not.toContain('קישור');
  });

  test('whitespace-only template falls back to default', () => {
    const text = buildShareText(SAMPLE_LEAD, '   ');
    expect(text).toContain('ליד חדש');
  });
});

// ─── buildWhatsappUrl ─────────────────────────────────────────────────────────

describe('buildWhatsappUrl', () => {
  test('builds correct wa.me URL', () => {
    const url = buildWhatsappUrl(SAMPLE_LEAD, '972501234567', '');
    expect(url.startsWith('https://wa.me/972501234567')).toBe(true);
    expect(url).toContain('text=');
    expect(url).toContain(encodeURIComponent('דוד לוי'));
  });

  test('strips non-digits from number', () => {
    const url = buildWhatsappUrl(SAMPLE_LEAD, '+972-50-1234567', '');
    expect(url).toContain('wa.me/972501234567');
  });

  test('empty number still builds url with empty destination', () => {
    const url = buildWhatsappUrl(SAMPLE_LEAD, '', '');
    expect(url.startsWith('https://wa.me/')).toBe(true);
  });
});

// ─── buildMailtoUrl ───────────────────────────────────────────────────────────

describe('buildMailtoUrl', () => {
  test('builds mailto with subject and body', () => {
    const url = buildMailtoUrl(SAMPLE_LEAD, 'test@example.com', '');
    expect(url.startsWith('mailto:test@example.com')).toBe(true);
    expect(url).toContain('subject=');
    expect(url).toContain('body=');
    expect(url).toContain(encodeURIComponent('דוד לוי'));
  });

  test('subject includes lead name', () => {
    const url = buildMailtoUrl(SAMPLE_LEAD, 'a@b.com', '');
    expect(decodeURIComponent(url)).toContain('דוד לוי');
  });

  test('empty email produces mailto: with empty address', () => {
    const url = buildMailtoUrl(SAMPLE_LEAD, '', '');
    expect(url.startsWith('mailto:')).toBe(true);
  });
});

// ─── postJson ─────────────────────────────────────────────────────────────────

describe('postJson', () => {
  function mockNetRequest({ statusCode = 200, error = null } = {}) {
    const req = {
      setHeader: jest.fn(),
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn()
    };
    req.on.mockImplementation((event, handler) => {
      if (event === 'response' && !error) {
        const res = {
          statusCode,
          on: jest.fn((ev, h) => { if (ev === 'data') {}; if (ev === 'end') setImmediate(h); })
        };
        setImmediate(() => handler(res));
      }
      if (event === 'error' && error) {
        setImmediate(() => handler(new Error(error)));
      }
    });
    electronMock.net.request.mockReturnValue(req);
    return req;
  }

  beforeEach(() => jest.clearAllMocks());

  test('resolves ok:true for 2xx response', async () => {
    mockNetRequest({ statusCode: 200 });
    const result = await postJson('https://example.com/hook', { test: true });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  test('resolves ok:false for 4xx response', async () => {
    mockNetRequest({ statusCode: 400 });
    const result = await postJson('https://example.com/hook', { test: true });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  test('resolves ok:false on network error', async () => {
    mockNetRequest({ error: 'ECONNREFUSED' });
    const result = await postJson('https://example.com/hook', { test: true });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('ECONNREFUSED');
  });

  test('sets custom header when both name and value given', async () => {
    const req = mockNetRequest({ statusCode: 200 });
    await postJson('https://example.com/', {}, 'Authorization', 'Bearer TOKEN');
    expect(req.setHeader).toHaveBeenCalledWith('Authorization', 'Bearer TOKEN');
  });

  test('skips custom header when name is empty', async () => {
    const req = mockNetRequest({ statusCode: 200 });
    await postJson('https://example.com/', {}, '', '');
    const headerCalls = req.setHeader.mock.calls.map((c) => c[0]);
    expect(headerCalls).not.toContain('');
    expect(headerCalls).toContain('Content-Type');
  });
});
