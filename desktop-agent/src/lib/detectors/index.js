// Registry for the "generic action" detectors - everything except phone
// numbers, which keep their own richer WhatsApp-composer popup in main.js.
// Order matters: first match wins, most-specific first.

const { findTrackingNumber } = require('./tracking');
const { findAddress } = require('./address');
const { findUrl } = require('./url');
const { findEmail } = require('./email');
const { findDateTime } = require('./datetime');
const { findCustomAction } = require('./custom');

const DETECTORS = [
  { key: 'tracking', find: findTrackingNumber },
  { key: 'address', find: findAddress },
  { key: 'datetime', find: findDateTime },
  { key: 'url', find: findUrl },
  { key: 'email', find: findEmail }
];

// enabledMap: e.g. settings.detectors = { tracking: true, address: true, url: true, email: true }
// customRules: settings.customActionRules — user-defined pattern -> URL rules
// (see ./custom.js), checked last so a mature built-in detector always gets
// first refusal over a user-authored regex that might be looser.
function findGenericAction(text, enabledMap, customRules) {
  const enabled = enabledMap || {};
  for (const detector of DETECTORS) {
    if (enabled[detector.key] === false) continue;
    const result = detector.find(text);
    if (result) return result;
  }
  if (customRules && customRules.length) {
    const result = findCustomAction(text, customRules);
    if (result) return result;
  }
  return null;
}

module.exports = { findGenericAction, DETECTORS };
