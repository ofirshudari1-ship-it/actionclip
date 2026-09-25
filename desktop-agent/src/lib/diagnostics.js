// Builds the redacted, structural-only payload for Settings ▸ About ▸
// "ייצוא אבחון" (Export Diagnostics). Kept as a pure function (no fs/dialog/
// electron imports) so it's directly unit-testable and so the redaction
// rules live in exactly one place, reviewable on their own.
//
// Hard rule this file exists to enforce: TapAct handles real personal data
// (leads' names/phones, clipboard contents, message templates). The
// diagnostics bundle must never carry any of that, or any secret capable of
// sending messages/webhooks on the user's behalf - only structural/technical
// facts useful for debugging (which channels are turned on, how many items
// are stored, etc).
'use strict';

const REDACTED = '[הוסר לצורך פרטיות]';

// Fields on leadSettings that are either a secret (can be used to send
// messages/webhooks/AI calls on the user's behalf) or personal data (a real
// phone number, email address or message template). Every other leadSettings
// field is structural (booleans, counts, thresholds) and safe to include.
const LEAD_SECRET_FIELDS = ['webhookUrl', 'webhookHeaderValue', 'slackWebhookUrl', 'aiApiKey'];
const LEAD_PERSONAL_FIELDS = ['whatsappNumber', 'emailAddress', 'messageTemplate', 'webhookHeaderName'];

/**
 * @param {object} raw - the full electron-store snapshot as returned by
 *   store.js's various getters, shaped like:
 *   { settings, leadSettings, templates, history, clipboardHistory,
 *     leadHistory, tagRules, customActionRules }
 * @returns {object} a JSON-safe object with no personal data or secrets.
 */
function buildRedactedSettingsSnapshot(raw) {
  const settings = raw.settings || {};
  const leadSettingsIn = raw.leadSettings || {};

  const leadSettingsOut = {};
  for (const [key, value] of Object.entries(leadSettingsIn)) {
    if (LEAD_SECRET_FIELDS.includes(key)) {
      leadSettingsOut[key] = value ? REDACTED : '(not set)';
    } else if (LEAD_PERSONAL_FIELDS.includes(key)) {
      leadSettingsOut[key] = value ? REDACTED : '(not set)';
    } else {
      leadSettingsOut[key] = value;
    }
  }

  return {
    settings,
    leadSettings: leadSettingsOut,
    // Only counts, never the actual content - the content is exactly what
    // must never leave the machine in this file (clipboard text, names,
    // phone numbers, message bodies).
    dataCounts: {
      templates: Array.isArray(raw.templates) ? raw.templates.length : 0,
      history: Array.isArray(raw.history) ? raw.history.length : 0,
      clipboardHistory: Array.isArray(raw.clipboardHistory) ? raw.clipboardHistory.length : 0,
      leadHistory: Array.isArray(raw.leadHistory) ? raw.leadHistory.length : 0,
      tagRules: Array.isArray(raw.tagRules) ? raw.tagRules.length : 0,
      customActionRules: Array.isArray(raw.customActionRules) ? raw.customActionRules.length : 0
    }
  };
}

/**
 * @param {object} sysInfo - { osType, osRelease, osArch, electronVersion,
 *   chromeVersion, nodeVersion, appVersion, buildDate, installPath }
 * @returns {string} plain-text system-info.txt contents
 */
function buildSystemInfoText(sysInfo) {
  const lines = [
    'TapAct - Diagnostics: System Info',
    '='.repeat(40),
    `TapAct version: ${sysInfo.appVersion || 'unknown'}`,
    `Build date: ${sysInfo.buildDate || 'unknown'}`,
    `OS: ${sysInfo.osType || 'unknown'} ${sysInfo.osRelease || ''} (${sysInfo.osArch || 'unknown'})`,
    `Electron: ${sysInfo.electronVersion || 'unknown'}`,
    `Chrome: ${sysInfo.chromeVersion || 'unknown'}`,
    `Node: ${sysInfo.nodeVersion || 'unknown'}`,
    `Install path: ${sysInfo.installPath || 'unknown'}`,
    `Generated: ${new Date().toISOString()}`
  ];
  return lines.join('\r\n') + '\r\n';
}

module.exports = { buildRedactedSettingsSnapshot, buildSystemInfoText, REDACTED, LEAD_SECRET_FIELDS, LEAD_PERSONAL_FIELDS };
