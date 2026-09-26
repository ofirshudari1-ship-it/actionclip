// Email-address detection, for a "compose to this address" action.
// Same intent-guard as url.js: only fires when the copied text is
// essentially just the address, not a sentence that happens to contain one -
// copying a paragraph with someone's email inside it isn't "I want to email
// them" intent.

const { t } = require('../i18n-renderer');

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function findEmail(text, lang) {
  if (typeof text !== 'string' || !text) return null;
  const trimmed = text.trim();
  if (trimmed.includes('\n') || trimmed.includes(' ')) return null;
  if (!EMAIL_RE.test(trimmed)) return null;

  return {
    type: 'email',
    raw: trimmed,
    display: trimmed,
    title: t(lang, 'detect.email.title'),
    actions: [
      { id: 'mailto', label: t(lang, 'detect.email.action.mailto').replace('{email}', trimmed), url: `mailto:${trimmed}` },
      { id: 'gmail', label: t(lang, 'detect.email.action.gmail'), url: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(trimmed)}` }
    ]
  };
}

module.exports = { findEmail };
