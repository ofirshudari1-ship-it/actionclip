// User-defined custom action rules — "beyond the built-in phone/tracking/
// address/url/email detectors" (competitor research: ClipboardFusion's
// custom clipboard Macros, PhraseExpress's user-defined triggers). Each
// rule is { id, label, pattern, urlTemplate, enabled }: `pattern` is a
// regex tested against the copied text, `urlTemplate` is a URL containing
// the literal token "{value}" which is replaced by the match (capture
// group 1 if the pattern has one, otherwise the whole match).
//
// Security: only http(s) URL templates are honored — this runs whatever
// the user typed into Settings, so `javascript:`/`file:`/etc. templates
// are rejected rather than ever reaching shell.openExternal. Malformed
// regex (bad syntax, or one so pathological it could hang the clipboard-
// poll timer) is caught defensively; a broken rule is skipped, not thrown.

const MAX_PATTERN_LENGTH = 200; // keeps user-authored regexes cheap to compile/run on every poll tick

function isSafeUrlTemplate(urlTemplate) {
  return typeof urlTemplate === 'string' && /^https?:\/\//i.test(urlTemplate.trim());
}

function compileRule(rule) {
  if (!rule || rule.enabled === false) return null;
  if (typeof rule.pattern !== 'string' || !rule.pattern || rule.pattern.length > MAX_PATTERN_LENGTH) return null;
  if (!isSafeUrlTemplate(rule.urlTemplate)) return null;
  try {
    return new RegExp(rule.pattern);
  } catch (err) {
    return null; // invalid regex syntax — skip this rule rather than crash the poll loop
  }
}

function findCustomAction(text, rules) {
  if (typeof text !== 'string' || !text || !Array.isArray(rules) || !rules.length) return null;

  for (const rule of rules) {
    const re = compileRule(rule);
    if (!re) continue;
    let match;
    try {
      match = text.match(re);
    } catch (err) {
      continue;
    }
    if (!match) continue;

    const value = match[1] !== undefined ? match[1] : match[0];
    const url = rule.urlTemplate.replace(/\{value\}/g, encodeURIComponent(value));

    return {
      type: 'custom',
      subtype: rule.id,
      raw: match[0],
      display: value,
      title: `${rule.label || 'כלל מותאם אישית'} זוהה`,
      actions: [{ id: 'custom', label: rule.actionLabel || `פתח (${rule.label || 'כלל מותאם'}) 🔗`, url }]
    };
  }
  return null;
}

module.exports = { findCustomAction, isSafeUrlTemplate };
