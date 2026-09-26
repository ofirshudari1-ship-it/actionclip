// Bare-URL detection, for a "open this link" action.
// Only fires when the copied text is (essentially) just the URL, not a
// sentence that happens to contain one - copying a paragraph with a link
// inside it is not "I want to open a link" intent, so we stay quiet there
// and let the user click the link where they read it instead.

const { t } = require('../i18n-renderer');

const URL_RE = /^(https?:\/\/[^\s]+|www\.[^\s]+\.[a-z]{2,}(?:\/[^\s]*)?)$/i;

function findUrl(text, lang) {
  if (typeof text !== 'string' || !text) return null;
  const trimmed = text.trim();
  if (trimmed.includes('\n') || trimmed.includes(' ')) return null;
  if (!URL_RE.test(trimmed)) return null;

  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let hostname = trimmed;
  try {
    hostname = new URL(href).hostname;
  } catch (err) {
    // keep the raw trimmed text as a fallback label
  }

  return {
    type: 'url',
    raw: trimmed,
    display: hostname,
    title: t(lang, 'detect.url.title'),
    actions: [
      { label: t(lang, 'detect.url.action.open').replace('{host}', hostname), url: href }
    ]
  };
}

module.exports = { findUrl };
