// Israeli phone-number detection & normalization.
// Mirrors chrome-extension/common.js so both surfaces behave identically.

function extractCandidates(text) {
  if (typeof text !== 'string' || !text) return [];
  return text.match(/(\+?\d[\d\-.\s()]{6,}\d)/g) || [];
}

// Returns E.164 digits without '+' (e.g. "972501234567" for mobile,
// "97231234567" for a landline), or null. Mobile: 05X-XXXXXXX (10 digits
// with the leading 0). Landline: 0X-XXXXXXX (9 digits with the leading 0).
function normalizeIsraeliPhone(raw) {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00972')) digits = digits.slice(2);
  if (digits.startsWith('972')) {
    // keep as-is
  } else if (digits.startsWith('0')) {
    digits = '972' + digits.slice(1);
  } else if (digits.length === 9 || digits.length === 8) {
    digits = '972' + digits;
  } else {
    return null;
  }
  if (!digits.startsWith('972')) return null;
  if (digits.length !== 11 && digits.length !== 12) return null;
  return digits;
}

function formatDisplay(normalized) {
  const local = '0' + normalized.slice(3);
  if (local.length === 10) return local.slice(0, 3) + '-' + local.slice(3);
  if (local.length === 9) return local.slice(0, 2) + '-' + local.slice(2);
  return local;
}

// International fallback (non-Israeli numbers) — only fires for an
// explicit "+countrycode..." copy. A bare local-looking number (no plus)
// is intentionally left alone here: without a country code there's no safe
// way to tell "052-1234567" (Israeli mobile, already handled above) apart
// from some other country's local format, so guessing would just produce
// false positives. Requiring the "+" keeps this additive and low-risk -
// it only ever matches text the Israeli-only detector already rejected.
function normalizeInternationalPhone(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('+')) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('972')) return null; // Israeli — normalizeIsraeliPhone already owns this
  // E.164 allows up to 15 digits total; a real number needs at least a
  // couple digits of country code plus a subscriber number.
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

// Best-effort grouping so the UI doesn't show one unbroken digit run -
// not authoritative per-country formatting (that needs a full numbering-
// plan database, out of scope for a lightweight local agent), just
// "country code, then groups of 3" which reads fine for the common cases
// a call center actually sees (UK/US/EU mobile numbers).
function formatInternationalDisplay(normalized) {
  const ccLen = normalized.length > 10 ? 3 : normalized.length > 9 ? 2 : 1;
  const cc = normalized.slice(0, ccLen);
  const rest = normalized.slice(ccLen);
  const groups = rest.match(/.{1,3}/g) || [rest];
  return `+${cc} ${groups.join('-')}`;
}

function findPhone(text) {
  const candidates = extractCandidates(text);
  for (const c of candidates) {
    const normalized = normalizeIsraeliPhone(c);
    if (normalized) {
      return { raw: c.trim(), normalized, display: formatDisplay(normalized) };
    }
  }
  for (const c of candidates) {
    const normalized = normalizeInternationalPhone(c);
    if (normalized) {
      return { raw: c.trim(), normalized, display: formatInternationalDisplay(normalized), international: true };
    }
  }
  return null;
}

function fillTemplate(text, name) {
  const trimmed = (name || '').trim();
  return text.split('{שם}').join(trimmed || '').replace(/\s{2,}/g, ' ').trim();
}

function buildWhatsAppUrl(normalizedPhone, message) {
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

module.exports = {
  findPhone,
  fillTemplate,
  buildWhatsAppUrl,
  normalizeIsraeliPhone,
  normalizeInternationalPhone,
  formatInternationalDisplay
};
