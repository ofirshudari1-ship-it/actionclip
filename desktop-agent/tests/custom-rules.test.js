const { findCustomAction, isSafeUrlTemplate } = require('../src/lib/detectors/custom');
const { findGenericAction } = require('../src/lib/detectors');

describe('isSafeUrlTemplate', () => {
  test('accepts http/https', () => {
    expect(isSafeUrlTemplate('https://example.com/{value}')).toBe(true);
    expect(isSafeUrlTemplate('http://example.com/{value}')).toBe(true);
  });
  test('rejects javascript: and other schemes', () => {
    expect(isSafeUrlTemplate('javascript:alert(1)')).toBe(false);
    expect(isSafeUrlTemplate('file:///etc/passwd')).toBe(false);
    expect(isSafeUrlTemplate('data:text/html,hi')).toBe(false);
  });
  test('rejects non-string / empty', () => {
    expect(isSafeUrlTemplate('')).toBe(false);
    expect(isSafeUrlTemplate(null)).toBe(false);
    expect(isSafeUrlTemplate(undefined)).toBe(false);
  });
});

describe('findCustomAction', () => {
  const rule = {
    id: 'order',
    label: 'הזמנה פנימית',
    pattern: 'ORD-(\\d{6})',
    urlTemplate: 'https://crm.example.com/orders/{value}',
    enabled: true
  };

  test('matches and substitutes capture group into URL', () => {
    const result = findCustomAction('ראה הזמנה ORD-123456 בבקשה', [rule]);
    expect(result).not.toBeNull();
    expect(result.type).toBe('custom');
    expect(result.display).toBe('123456');
    expect(result.actions[0].url).toBe('https://crm.example.com/orders/123456');
  });

  test('falls back to whole match when pattern has no capture group', () => {
    const noGroupRule = { ...rule, id: 'x', pattern: 'ORD-\\d{6}' };
    const result = findCustomAction('ORD-654321', [noGroupRule]);
    expect(result).not.toBeNull();
    expect(result.display).toBe('ORD-654321');
    expect(result.actions[0].url).toBe('https://crm.example.com/orders/ORD-654321');
  });

  test('disabled rule is skipped', () => {
    const disabled = { ...rule, enabled: false };
    expect(findCustomAction('ORD-123456', [disabled])).toBeNull();
  });

  test('unsafe URL template rejected even if pattern matches', () => {
    const unsafe = { ...rule, urlTemplate: 'javascript:alert(1)//{value}' };
    expect(findCustomAction('ORD-123456', [unsafe])).toBeNull();
  });

  test('invalid regex syntax does not throw and is skipped', () => {
    const bad = { ...rule, pattern: '(unclosed' };
    expect(() => findCustomAction('ORD-123456', [bad])).not.toThrow();
    expect(findCustomAction('ORD-123456', [bad])).toBeNull();
  });

  test('no match returns null', () => {
    expect(findCustomAction('nothing relevant here', [rule])).toBeNull();
  });

  test('empty/non-array rules returns null without throwing', () => {
    expect(findCustomAction('ORD-123456', [])).toBeNull();
    expect(findCustomAction('ORD-123456', null)).toBeNull();
    expect(findCustomAction('ORD-123456', undefined)).toBeNull();
  });

  test('non-string text returns null without throwing', () => {
    expect(() => findCustomAction(null, [rule])).not.toThrow();
    expect(findCustomAction(null, [rule])).toBeNull();
  });

  test('first matching rule wins, in list order', () => {
    const first = { id: 'a', label: 'A', pattern: 'FOO-(\\d+)', urlTemplate: 'https://a.example.com/{value}', enabled: true };
    const second = { id: 'b', label: 'B', pattern: 'FOO-(\\d+)', urlTemplate: 'https://b.example.com/{value}', enabled: true };
    const result = findCustomAction('FOO-42', [first, second]);
    expect(result.actions[0].url).toBe('https://a.example.com/42');
  });
});

describe('findGenericAction with custom rules', () => {
  const rule = {
    id: 'order',
    label: 'הזמנה פנימית',
    pattern: 'ORD-(\\d{6})',
    urlTemplate: 'https://crm.example.com/orders/{value}',
    enabled: true
  };

  test('built-in detectors still take priority over a custom rule', () => {
    // A URL should still be caught by the built-in url detector even when
    // custom rules are configured, since custom rules run last.
    const result = findGenericAction('https://example.com', {}, [rule]);
    expect(result.type).toBe('url');
  });

  test('custom rule fires when no built-in detector matches', () => {
    const result = findGenericAction('ORD-123456', {}, [rule]);
    expect(result).not.toBeNull();
    expect(result.type).toBe('custom');
  });

  test('works with no custom rules passed (backward compatible)', () => {
    expect(() => findGenericAction('plain text', {})).not.toThrow();
    expect(findGenericAction('plain text', {})).toBeNull();
  });
});
