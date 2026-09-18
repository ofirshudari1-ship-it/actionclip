let state = {
  phone: null,       // { raw, normalized, display }
  templates: [],
  selectedTemplateId: null,
  history: [],
  sendDedupeMinutes: 0,
  leadSettings: {},
  leadHistory: [],
  dupConfirmedPhone: null   // phone we already warned about and user OK'd
};
const els = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgoLabel(ts) {
  const mins = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (mins < 60) return `לפני ${mins} דק'`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `לפני ${hours} שע'`;
  return `לפני ${Math.round(hours / 24)} ימים`;
}

function fillWhatsappTemplate(text, name) {
  return text.split('{שם}').join((name || '').trim()).replace(/\s{2,}/g, ' ').trim();
}

function currentLead() {
  return {
    name: (els.nameInput.value || '').trim(),
    phone: state.phone ? state.phone.display : '',
    role: (els.roleInput.value || '').trim(),
    source: els.sourceSelect.value || 'אחר',
    url: ''
  };
}

// ─── Duplicate detection ──────────────────────────────────────────────────────

function refreshDupWarning() {
  if (!state.phone) { els.dupWarningBlock.classList.add('hidden'); return; }
  if (state.dupConfirmedPhone && state.dupConfirmedPhone === state.phone.normalized) {
    els.dupWarningBlock.classList.add('hidden'); return;
  }

  // Check WA send history (sendDedupeMinutes window)
  const waCutoff = Date.now() - (state.sendDedupeMinutes || 0) * 60 * 1000;
  const waRecent = (state.sendDedupeMinutes > 0)
    ? (state.history || []).find((h) => h.normalized === state.phone.normalized && h.sentAt >= waCutoff)
    : null;

  // Check lead history (duplicateWindowHours window)
  const dupHours = (state.leadSettings && state.leadSettings.duplicateWindowHours) || 6;
  const leadCutoff = Date.now() - dupHours * 60 * 60 * 1000;
  const phoneDigits = state.phone.normalized.replace(/\D/g, '');
  const leadRecent = (state.leadHistory || []).find((h) => {
    if (!(h.sentAt >= leadCutoff)) return false;
    return (h.phone || '').replace(/\D/g, '') === phoneDigits;
  });

  const recent = waRecent || leadRecent;
  if (recent) {
    const who = recent.name ? ` (${recent.name})` : '';
    els.dupWarningText.textContent = `כבר נשלח ליד למספר הזה ${timeAgoLabel(recent.sentAt)}${who}.`;
    els.dupWarningBlock.classList.remove('hidden');
  } else {
    els.dupWarningBlock.classList.add('hidden');
  }
}

// ─── WhatsApp message preview ─────────────────────────────────────────────────

function refreshMessage() {
  const template = state.templates.find((t) => t.id === state.selectedTemplateId) || state.templates[0];
  if (!template) return;
  els.messageArea.value = fillWhatsappTemplate(template.text, els.nameInput.value);
}

// ─── Channels visibility ──────────────────────────────────────────────────────

function applyChannelVisibility() {
  const ls = state.leadSettings;
  const hasAny = ls.channelWhatsapp || ls.channelWebhook || ls.channelSlack || ls.channelEmail || ls.channelCopy;

  els.btnWhatsapp.classList.toggle('hidden', !ls.channelWhatsapp);
  els.btnWebhook.classList.toggle('hidden', !ls.channelWebhook);
  els.btnSlack.classList.toggle('hidden', !ls.channelSlack);
  els.btnEmail.classList.toggle('hidden', !ls.channelEmail);
  els.btnCopy.classList.toggle('hidden', !ls.channelCopy);

  // WhatsApp template section only when WA is configured
  els.whatsappSection.classList.toggle('hidden', !ls.channelWhatsapp);

  // "Send all" only when more than one channel
  const activeCount = [ls.channelWhatsapp, ls.channelWebhook, ls.channelSlack, ls.channelEmail, ls.channelCopy].filter(Boolean).length;
  els.sendAllBtn.classList.toggle('hidden', activeCount < 2);

  // No channels notice
  els.noChannelsNotice.classList.toggle('hidden', hasAny);

  // AI button
  els.aiImproveBtn.classList.toggle('hidden', !(ls.aiEnabled && ls.aiApiKey));
}

// ─── Phone apply ─────────────────────────────────────────────────────────────

function applyPhone(phone) {
  state.phone = phone;
  if (phone) {
    els.phoneDisplay.textContent = phone.display;
    els.phoneFoundBlock.classList.remove('hidden');
    els.phoneMissingBlock.classList.add('hidden');
  } else {
    els.phoneFoundBlock.classList.add('hidden');
    els.phoneMissingBlock.classList.remove('hidden');
  }
  refreshDupWarning();
  refreshMessage();
}

// ─── Send helpers ─────────────────────────────────────────────────────────────

function showStatus(msg, kind) {
  els.sendStatus.textContent = msg;
  els.sendStatus.className = 'send-status ' + kind;
  els.sendStatus.classList.remove('hidden');
  if (kind === 'ok') setTimeout(() => window.actionclip.dismiss(), 1200);
}

async function doSendChannel(channel) {
  const lead = currentLead();
  const ls = state.leadSettings;

  if (channel === 'whatsapp') {
    const template = state.templates.find((t) => t.id === state.selectedTemplateId) || state.templates[0];
    const message = template ? fillWhatsappTemplate(template.text, lead.name) : '';
    window.actionclip.sendWhatsapp({ phone: state.phone, message, name: lead.name, templateLabel: template?.label || '' });
    return { ok: true };
  }

  return window.actionclip.sendLeadChannel({ channel, lead, leadSettings: ls });
}

async function onSendChannel(channel) {
  const btn = els[`btn${channel.charAt(0).toUpperCase() + channel.slice(1)}`];
  if (btn) { btn.disabled = true; btn.textContent = '⏳ שולח...'; }

  const result = await doSendChannel(channel);

  if (btn) {
    btn.disabled = false;
    const labels = { whatsapp: '💬 WhatsApp', webhook: '🔗 Webhook', slack: '💼 Slack', email: '✉️ מייל', copy: '📋 העתק' };
    btn.textContent = result.ok ? '✓ ' + (labels[channel] || channel) : '✗ שגיאה';
    setTimeout(() => { btn.textContent = labels[channel] || channel; }, 2000);
  }

  if (!result.ok && result.error) showStatus('שגיאה: ' + result.error, 'fail');
}

async function onSendAll() {
  els.sendAllBtn.disabled = true;
  els.sendAllBtn.textContent = '⏳ שולח...';

  const ls = state.leadSettings;
  const channels = ['whatsapp', 'webhook', 'slack', 'email', 'copy'].filter((c) => ls[`channel${c.charAt(0).toUpperCase() + c.slice(1)}`]);
  const results = await Promise.all(channels.map((c) => doSendChannel(c)));
  const allOk = results.every((r) => r.ok);
  const errors = results.filter((r) => !r.ok).map((r) => r.error).filter(Boolean);

  els.sendAllBtn.disabled = false;
  els.sendAllBtn.textContent = 'שלח לכל הערוצים';

  if (allOk) {
    showStatus('✓ נשלח בהצלחה לכל הערוצים!', 'ok');
  } else {
    showStatus('חלק מהערוצים נכשלו: ' + errors.join(', '), 'fail');
  }
}

// ─── AI Assist ────────────────────────────────────────────────────────────────

async function onAiImprove() {
  els.aiImproveBtn.disabled = true;
  els.aiImproveBtn.textContent = '⏳ מנתח...';
  els.aiStatus.textContent = 'שולח ל-AI...';
  els.aiStatus.classList.remove('hidden');

  const lead = currentLead();
  const result = await window.actionclip.aiCleanupLead(lead);

  els.aiImproveBtn.disabled = false;
  els.aiImproveBtn.textContent = '✨ שפר עם AI';

  if (result.ok) {
    els.nameInput.value = result.lead.name || els.nameInput.value;
    els.roleInput.value = result.lead.role || els.roleInput.value;
    if (result.lead.source && result.lead.source !== 'אחר') {
      els.sourceSelect.value = result.lead.source;
    }
    els.aiStatus.textContent = '✓ AI שיפר את הנתונים';
    refreshMessage();
    setTimeout(() => els.aiStatus.classList.add('hidden'), 2000);
  } else {
    els.aiStatus.textContent = '✗ ' + (result.error || 'שגיאת AI');
    setTimeout(() => els.aiStatus.classList.add('hidden'), 3000);
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  els.phoneFoundBlock   = document.getElementById('phoneFoundBlock');
  els.phoneMissingBlock = document.getElementById('phoneMissingBlock');
  els.phoneDisplay      = document.getElementById('phoneDisplay');
  els.manualPhone       = document.getElementById('manualPhone');
  els.checkManualBtn    = document.getElementById('checkManualBtn');
  els.dupWarningBlock   = document.getElementById('dupWarningBlock');
  els.dupWarningText    = document.getElementById('dupWarningText');
  els.dupConfirmBtn     = document.getElementById('dupConfirmBtn');
  els.nameInput         = document.getElementById('nameInput');
  els.roleInput         = document.getElementById('roleInput');
  els.sourceSelect      = document.getElementById('sourceSelect');
  els.templateSelect    = document.getElementById('templateSelect');
  els.messageArea       = document.getElementById('messageArea');
  els.whatsappSection   = document.getElementById('whatsappSection');
  els.aiImproveBtn      = document.getElementById('aiImproveBtn');
  els.aiStatus          = document.getElementById('aiStatus');
  els.btnWhatsapp       = document.getElementById('btnWhatsapp');
  els.btnWebhook        = document.getElementById('btnWebhook');
  els.btnSlack          = document.getElementById('btnSlack');
  els.btnEmail          = document.getElementById('btnEmail');
  els.btnCopy           = document.getElementById('btnCopy');
  els.sendAllBtn        = document.getElementById('sendAllBtn');
  els.noChannelsNotice  = document.getElementById('noChannelsNotice');
  els.sendStatus        = document.getElementById('sendStatus');
  els.settingsBtn       = document.getElementById('settingsBtn');
  els.closeBtn          = document.getElementById('closeBtn');
  els.openLeadSettingsLink = document.getElementById('openLeadSettingsLink');

  const data = await window.actionclip.getInitData();

  // Apply language and theme from saved settings
  if (typeof window.i18n !== 'undefined') {
    const lang = (data.settings && data.settings.language) || 'he';
    const theme = (data.settings && data.settings.theme) || 'dark';
    window.i18n.applyI18n(lang);
    document.documentElement.setAttribute('data-theme', theme);
  }

  state.templates         = data.templates;
  state.selectedTemplateId = data.defaultTemplateId;
  state.history           = data.history || [];
  state.sendDedupeMinutes = data.sendDedupeMinutes || 0;
  state.leadSettings      = data.leadSettings || {};
  state.leadHistory       = data.leadHistory || [];

  // Populate template select
  for (const t of state.templates) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.label;
    els.templateSelect.appendChild(opt);
  }
  els.templateSelect.value = state.selectedTemplateId;

  // Populate custom sources
  const ls = state.leadSettings;
  (ls.customSources || []).forEach((src) => {
    const opt = document.createElement('option');
    opt.value = src;
    opt.textContent = src;
    els.sourceSelect.appendChild(opt);
  });

  applyChannelVisibility();
  applyPhone(data.phone);

  // Events
  els.templateSelect.addEventListener('change', () => {
    state.selectedTemplateId = els.templateSelect.value;
    refreshMessage();
  });
  els.nameInput.addEventListener('input', () => { refreshMessage(); notifyActivity(); });
  els.messageArea.addEventListener('input', notifyActivity);
  els.roleInput.addEventListener('input', notifyActivity);

  els.checkManualBtn.addEventListener('click', checkManualPhone);
  els.manualPhone.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkManualPhone(); });

  els.btnWhatsapp.addEventListener('click', () => onSendChannel('whatsapp'));
  els.btnWebhook.addEventListener('click', () => onSendChannel('webhook'));
  els.btnSlack.addEventListener('click', () => onSendChannel('slack'));
  els.btnEmail.addEventListener('click', () => onSendChannel('email'));
  els.btnCopy.addEventListener('click', () => onSendChannel('copy'));
  els.sendAllBtn.addEventListener('click', onSendAll);
  els.aiImproveBtn.addEventListener('click', onAiImprove);

  els.dupConfirmBtn.addEventListener('click', () => {
    state.dupConfirmedPhone = state.phone?.normalized || null;
    els.dupWarningBlock.classList.add('hidden');
  });
  els.settingsBtn.addEventListener('click', () => window.actionclip.openSettings());
  els.closeBtn.addEventListener('click', () => window.actionclip.dismiss());
  els.openLeadSettingsLink?.addEventListener('click', (e) => { e.preventDefault(); window.actionclip.openLeadSettings(); });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.actionclip.dismiss(); });

  if (data.phone) els.nameInput.focus();
  else els.manualPhone.focus();
});

async function checkManualPhone() {
  const found = await window.actionclip.checkPhone(els.manualPhone.value);
  if (found) { applyPhone(found); els.nameInput.focus(); }
  else { els.manualPhone.focus(); els.manualPhone.select(); }
}

let activityThrottle = null;
function notifyActivity() {
  if (activityThrottle) return;
  activityThrottle = setTimeout(() => { activityThrottle = null; }, 500);
  window.actionclip.notifyActivity();
}
