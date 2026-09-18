// Email-address detection, for a "compose to this address" action.
// Same intent-guard as url.js: only fires when the copied text is
// essentially just the address, not a sentence that happens to contain one -
// copying a paragraph with someone's email inside it isn't "I want to email
// them" intent.

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function findEmail(text) {
  if (typeof text !== 'string' || !text) return null;
  const trimmed = text.trim();
  if (trimmed.includes('\n') || trimmed.includes(' ')) return null;
  if (!EMAIL_RE.test(trimmed)) return null;

  return {
    type: 'email',
    raw: trimmed,
    display: trimmed,
    title: 'כתובת אימייל זוהתה',
    actions: [
      { id: 'mailto', label: `פתח מייל חדש אל ${trimmed} ✉️`, url: `mailto:${trimmed}` },
      { id: 'gmail', label: 'פתח ב-Gmail 📧', url: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(trimmed)}` }
    ]
  };
}

module.exports = { findEmail };
