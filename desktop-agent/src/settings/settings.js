let templates = [];
let defaultId = null;
let settings = {};
let shortcuts = {};
let defaultShortcuts = { manual: 'CommandOrControl+Alt+P', history: 'Super+V', historyFallback: 'CommandOrControl+Alt+V' };
let tagRules = [];
let customRules = [];

const s = {};

const SHORTCUT_KEYS = { manual: 'shortcutManualInput', history: 'shortcutHistoryInput', historyFallback: 'shortcutFallbackInput' };
const SHORTCUT_STATUS_KEYS = { manual: 'shortcutManualStatus', history: 'shortcutHistoryStatus', historyFallback: 'shortcutFallbackStatus' };

function acceleratorFromEvent(e) {
  const parts = [];
  if (e.ctrlKey) parts.push('CommandOrControl');
  if (e.metaKey) parts.push('Super');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  const key = e.key;
  const modifierKeys = ['Control', 'Meta', 'Alt', 'Shift'];
  if (modifierKeys.includes(key)) return null; // wait for a real key on top of the modifiers
  const normalized = key.length === 1 ? key.toUpperCase() : key;
  parts.push(normalized);
  return parts.join('+');
}

function setupShortcutCapture(field) {
  const input = s[SHORTCUT_KEYS[field]];
  input.addEventListener('click', () => {
    input.classList.add('capturing');
    input.value = 'הקש קיצור...';
    const onKey = (e) => {
      e.preventDefault();
      const accelerator = acceleratorFromEvent(e);
      if (!accelerator) return;
      shortcuts[field] = accelerator;
      input.value = accelerator;
      input.classList.remove('capturing');
      document.removeEventListener('keydown', onKey, true);
    };
    document.addEventListener('keydown', onKey, true);
  });
}

function renderShortcuts(status) {
  for (const field of Object.keys(SHORTCUT_KEYS)) {
    s[SHORTCUT_KEYS[field]].value = shortcuts[field] || defaultShortcuts[field];
    const statusEl = s[SHORTCUT_STATUS_KEYS[field]];
    if (status[field] === true) { statusEl.textContent = '✓ פעיל'; statusEl.className = 'shortcut-status ok'; }
    else if (status[field] === false) { statusEl.textContent = '✗ תפוס'; statusEl.className = 'shortcut-status fail'; }
    else { statusEl.textContent = ''; statusEl.className = 'shortcut-status'; }
  }
  // Hide the Win+V hint when it's actually registered
  if (s.shortcutHint) {
    s.shortcutHint.classList.toggle('hidden', status.history === true);
  }
}

async function onSaveShortcuts() {
  const result = await window.actionclipSettings.saveShortcuts(shortcuts);
  renderShortcuts(result || {});
  s.savedShortcutsMsg.classList.remove('hidden');
  setTimeout(() => s.savedShortcutsMsg.classList.add('hidden'), 2200);
}

async function onResetShortcuts() {
  const result = await window.actionclipSettings.resetShortcuts();
  shortcuts = { ...defaultShortcuts };
  renderShortcuts(result || {});
  s.savedShortcutsMsg.classList.remove('hidden');
  setTimeout(() => s.savedShortcutsMsg.classList.add('hidden'), 2200);
}

function renderTagRules() {
  s.tagRulesList.replaceChildren();
  for (const rule of tagRules) s.tagRulesList.appendChild(buildTagRuleCard(rule));
}

function buildTagRuleCard(rule) {
  const card = document.createElement('div');
  card.className = 'tag-card';

  const head = document.createElement('div');
  head.className = 'tag-card-head';

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.placeholder = 'שם התגית';
  labelInput.value = rule.label;
  labelInput.style.flex = '1';
  labelInput.addEventListener('input', () => { rule.label = labelInput.value; });

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn danger xs';
  removeBtn.textContent = '✕ מחק';
  removeBtn.addEventListener('click', () => {
    tagRules = tagRules.filter((r) => r !== rule);
    renderTagRules();
  });

  head.appendChild(labelInput);
  head.appendChild(removeBtn);

  const keywordsInput = document.createElement('input');
  keywordsInput.type = 'text';
  keywordsInput.placeholder = 'מילות מפתח, מופרדות בפסיק (למשל: פרויקט, project)';
  keywordsInput.value = (rule.keywords || []).join(', ');
  keywordsInput.style.width = '100%';
  keywordsInput.addEventListener('input', () => {
    rule.keywords = keywordsInput.value.split(',').map((k) => k.trim()).filter(Boolean);
  });

  card.appendChild(head);
  card.appendChild(keywordsInput);
  return card;
}

async function onSaveTagRules() {
  const result = await window.actionclipSettings.saveTagRules(tagRules);
  if (Array.isArray(result)) tagRules = result;
  renderTagRules();
  s.savedTagRulesMsg.classList.remove('hidden');
  setTimeout(() => s.savedTagRulesMsg.classList.add('hidden'), 1800);
}

function renderCustomRules() {
  s.customRulesList.replaceChildren();
  for (const rule of customRules) s.customRulesList.appendChild(buildCustomRuleCard(rule));
}

function buildCustomRuleCard(rule) {
  const card = document.createElement('div');
  card.className = 'tag-card';

  const head = document.createElement('div');
  head.className = 'tag-card-head';

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.placeholder = 'שם הכלל (למשל: מספר הזמנה פנימי)';
  labelInput.value = rule.label || '';
  labelInput.style.flex = '1';
  labelInput.addEventListener('input', () => { rule.label = labelInput.value; });

  const enabledSwitch = document.createElement('span');
  enabledSwitch.className = 'switch';
  const enabledInput = document.createElement('input');
  enabledInput.type = 'checkbox';
  enabledInput.checked = rule.enabled !== false;
  enabledInput.title = 'פעיל';
  enabledInput.addEventListener('change', () => { rule.enabled = enabledInput.checked; });
  const enabledSlider = document.createElement('span');
  enabledSlider.className = 'slider';
  enabledSwitch.appendChild(enabledInput);
  enabledSwitch.appendChild(enabledSlider);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn danger xs';
  removeBtn.textContent = '✕ מחק';
  removeBtn.addEventListener('click', () => {
    customRules = customRules.filter((r) => r !== rule);
    renderCustomRules();
  });

  head.appendChild(labelInput);
  head.appendChild(enabledSwitch);
  head.appendChild(removeBtn);

  const patternInput = document.createElement('input');
  patternInput.type = 'text';
  patternInput.dir = 'ltr';
  patternInput.placeholder = 'ביטוי רגולרי, למשל: ORD-(\\d{6})';
  patternInput.value = rule.pattern || '';
  patternInput.style.width = '100%';
  patternInput.addEventListener('input', () => { rule.pattern = patternInput.value; });

  const urlInput = document.createElement('input');
  urlInput.type = 'text';
  urlInput.dir = 'ltr';
  urlInput.placeholder = 'https://crm.example.com/orders/{value}';
  urlInput.value = rule.urlTemplate || '';
  urlInput.style.width = '100%';
  urlInput.addEventListener('input', () => { rule.urlTemplate = urlInput.value; });

  const actionLabelInput = document.createElement('input');
  actionLabelInput.type = 'text';
  actionLabelInput.placeholder = 'טקסט לכפתור (אופציונלי)';
  actionLabelInput.value = rule.actionLabel || '';
  actionLabelInput.style.width = '100%';
  actionLabelInput.addEventListener('input', () => { rule.actionLabel = actionLabelInput.value; });

  card.appendChild(head);
  card.appendChild(patternInput);
  card.appendChild(urlInput);
  card.appendChild(actionLabelInput);
  return card;
}

async function onSaveCustomRules() {
  const result = await window.actionclipSettings.saveCustomRules(customRules);
  if (Array.isArray(result)) customRules = result;
  renderCustomRules();
  s.savedCustomRulesMsg.classList.remove('hidden');
  setTimeout(() => s.savedCustomRulesMsg.classList.add('hidden'), 1800);
}

function timeAgoLabel(timestamp) {
  const mins = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
  if (mins < 60) return `לפני ${mins} דק'`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `לפני ${hours} שע'`;
  return `לפני ${Math.round(hours / 24)} ימים`;
}

document.addEventListener('DOMContentLoaded', async () => {
  s.list = document.getElementById('list');
  s.addBtn = document.getElementById('addBtn');
  s.defaultSelect = document.getElementById('defaultSelect');
  s.saveTemplatesBtn = document.getElementById('saveTemplatesBtn');
  s.resetBtn = document.getElementById('resetBtn');
  s.savedMsg = document.getElementById('savedMsg');
  s.enabledCheck = document.getElementById('enabledCheck');
  s.autoLaunchCheck = document.getElementById('autoLaunchCheck');
  s.startMinimizedCheck = document.getElementById('startMinimizedCheck');
  s.closeToTrayCheck = document.getElementById('closeToTrayCheck');
  s.showTrayNotificationCheck = document.getElementById('showTrayNotificationCheck');
  s.soundOnDetectCheck = document.getElementById('soundOnDetectCheck');
  s.startPausedCheck = document.getElementById('startPausedCheck');
  s.widgetEnabledCheck = document.getElementById('widgetEnabledCheck');
  s.trayClickSelect = document.getElementById('trayClickSelect');
  s.quietHoursEnabledCheck = document.getElementById('quietHoursEnabledCheck');
  s.quietHoursStartInput = document.getElementById('quietHoursStartInput');
  s.quietHoursEndInput = document.getElementById('quietHoursEndInput');
  s.saveQuietHoursBtn = document.getElementById('saveQuietHoursBtn');
  s.savedQuietHoursMsg = document.getElementById('savedQuietHoursMsg');
  s.languageSeg = document.getElementById('languageSeg');
  s.themeSeg = document.getElementById('themeSeg');
  s.langToggleBtn = document.getElementById('langToggleBtn');
  s.themeToggleBtn = document.getElementById('themeToggleBtn');
  s.pollInput = document.getElementById('pollInput');
  s.dedupeInput = document.getElementById('dedupeInput');
  s.autoCloseInput = document.getElementById('autoCloseInput');
  s.sendDedupeInput = document.getElementById('sendDedupeInput');
  s.saveSettingsBtn = document.getElementById('saveSettingsBtn');
  s.detectPhoneCheck = document.getElementById('detectPhoneCheck');
  s.detectTrackingCheck = document.getElementById('detectTrackingCheck');
  s.detectAddressCheck = document.getElementById('detectAddressCheck');
  s.detectUrlCheck = document.getElementById('detectUrlCheck');
  s.detectEmailCheck = document.getElementById('detectEmailCheck');
  s.detectDatetimeCheck = document.getElementById('detectDatetimeCheck');
  s.saveDetectorsBtn = document.getElementById('saveDetectorsBtn');
  s.savedDetectorsMsg = document.getElementById('savedDetectorsMsg');
  s.clipHistoryEnabledCheck = document.getElementById('clipHistoryEnabledCheck');
  s.clipHistoryStorageInput = document.getElementById('clipHistoryStorageInput');
  s.clipHistoryPreviewInput = document.getElementById('clipHistoryPreviewInput');
  s.saveClipHistorySettingsBtn = document.getElementById('saveClipHistorySettingsBtn');
  s.clearClipHistoryBtn = document.getElementById('clearClipHistoryBtn');
  s.savedClipHistoryMsg = document.getElementById('savedClipHistoryMsg');
  s.historyList = document.getElementById('historyList');
  s.historyEmpty = document.getElementById('historyEmpty');
  s.clearHistoryBtn = document.getElementById('clearHistoryBtn');
  s.exportCsvBtn = document.getElementById('exportCsvBtn');
  s.exportMsg = document.getElementById('exportMsg');
  s.versionLabel = document.getElementById('versionLabel');
  s.aboutVersion = document.getElementById('aboutVersion');
  s.aboutBuildDate = document.getElementById('aboutBuildDate');
  s.openChangelogBtn = document.getElementById('openChangelogBtn');
  s.openSiteBtn = document.getElementById('openSiteBtn');
  s.shortcutManualInput = document.getElementById('shortcutManualInput');
  s.shortcutHistoryInput = document.getElementById('shortcutHistoryInput');
  s.shortcutFallbackInput = document.getElementById('shortcutFallbackInput');
  s.shortcutManualStatus = document.getElementById('shortcutManualStatus');
  s.shortcutHistoryStatus = document.getElementById('shortcutHistoryStatus');
  s.shortcutFallbackStatus = document.getElementById('shortcutFallbackStatus');
  s.saveShortcutsBtn = document.getElementById('saveShortcutsBtn');
  s.resetShortcutsBtn = document.getElementById('resetShortcutsBtn');
  s.savedShortcutsMsg = document.getElementById('savedShortcutsMsg');
  s.tagRulesList = document.getElementById('tagRulesList');
  s.addTagRuleBtn = document.getElementById('addTagRuleBtn');
  s.saveTagRulesBtn = document.getElementById('saveTagRulesBtn');
  s.savedTagRulesMsg = document.getElementById('savedTagRulesMsg');
  s.customRulesList = document.getElementById('customRulesList');
  s.addCustomRuleBtn = document.getElementById('addCustomRuleBtn');
  s.saveCustomRulesBtn = document.getElementById('saveCustomRulesBtn');
  s.savedCustomRulesMsg = document.getElementById('savedCustomRulesMsg');
  s.prefPhoneSelect = document.getElementById('prefPhoneSelect');
  s.prefAddressSelect = document.getElementById('prefAddressSelect');
  s.prefTrackingSelect = document.getElementById('prefTrackingSelect');
  s.prefEmailSelect = document.getElementById('prefEmailSelect');
  s.autoRunCheck = document.getElementById('autoRunCheck');
  s.autoRunDelayInput = document.getElementById('autoRunDelayInput');
  s.saveActionPrefsBtn = document.getElementById('saveActionPrefsBtn');
  s.savedActionPrefsMsg = document.getElementById('savedActionPrefsMsg');
  s.savedSettingsMsg = document.getElementById('savedSettingsMsg');
  s.shortcutHint = document.getElementById('shortcutHint');

  setupTabs();

  const data = await window.actionclipSettings.getData();
  templates = data.templates.map(t => ({ ...t }));
  defaultId = data.defaultTemplateId;
  settings = data.settings;
  s.versionLabel.textContent = data.version ? `v${data.version}` : '';
  if (s.aboutVersion) s.aboutVersion.textContent = data.version ? `v${data.version}` : '—';
  if (s.aboutBuildDate) s.aboutBuildDate.textContent = data.buildDate || '—';
  if (s.openChangelogBtn) s.openChangelogBtn.addEventListener('click', () => {
    window.actionclipSettings.openExternal && window.actionclipSettings.openExternal('changelog');
  });
  if (s.openSiteBtn) s.openSiteBtn.addEventListener('click', () => {
    window.actionclipSettings.openExternal && window.actionclipSettings.openExternal('site');
  });

  s.enabledCheck.checked = settings.enabled;
  s.autoLaunchCheck.checked = settings.autoLaunch;
  s.pollInput.value = settings.pollMs;
  s.dedupeInput.value = settings.dedupeSeconds;
  s.autoCloseInput.value = settings.autoCloseSeconds;
  s.sendDedupeInput.value = settings.sendDedupeMinutes;

  const detectors = settings.detectors || {};
  s.detectPhoneCheck.checked = detectors.phone !== false;
  s.detectTrackingCheck.checked = detectors.tracking !== false;
  s.detectAddressCheck.checked = detectors.address !== false;
  s.detectUrlCheck.checked = detectors.url !== false;
  s.detectEmailCheck.checked = detectors.email !== false;
  s.detectDatetimeCheck.checked = detectors.datetime !== false;

  s.clipHistoryEnabledCheck.checked = settings.historyEnabled !== false;
  s.clipHistoryStorageInput.value = settings.historyStorageLimit || 1000;
  s.clipHistoryPreviewInput.value = settings.historyPreviewLimit || 50;

  const prefs = settings.actionPreferences || {};
  s.prefPhoneSelect.value = prefs.phone || '';
  s.prefAddressSelect.value = prefs.address || '';
  s.prefTrackingSelect.value = prefs.tracking || '';
  s.prefEmailSelect.value = prefs.email || '';
  s.autoRunCheck.checked = settings.autoRunAction === true;
  s.autoRunDelayInput.value = settings.autoRunDelaySeconds || 4;

  // New settings
  if (s.startMinimizedCheck) s.startMinimizedCheck.checked = settings.startMinimized === true;
  if (s.closeToTrayCheck) s.closeToTrayCheck.checked = settings.closeToTray !== false;
  if (s.showTrayNotificationCheck) s.showTrayNotificationCheck.checked = settings.showTrayNotification !== false;
  if (s.soundOnDetectCheck) s.soundOnDetectCheck.checked = settings.soundOnDetect === true;
  if (s.startPausedCheck) s.startPausedCheck.checked = settings.startPaused === true;
  if (s.widgetEnabledCheck) s.widgetEnabledCheck.checked = settings.widgetEnabled !== false;
  if (s.trayClickSelect) s.trayClickSelect.value = settings.trayClickAction || 'history';

  const quietHours = settings.quietHours || {};
  if (s.quietHoursEnabledCheck) s.quietHoursEnabledCheck.checked = quietHours.enabled === true;
  if (s.quietHoursStartInput) s.quietHoursStartInput.value = quietHours.start || '18:00';
  if (s.quietHoursEndInput) s.quietHoursEndInput.value = quietHours.end || '08:00';

  // Language & theme
  const currentLang = settings.language || 'en';
  const currentTheme = settings.theme || 'dark';
  applyAppLanguage(currentLang);
  applyAppTheme(currentTheme);

  defaultShortcuts = data.defaultShortcuts || defaultShortcuts;
  shortcuts = { ...defaultShortcuts, ...(settings.shortcuts || {}) };
  renderShortcuts(data.shortcutStatus || {});

  tagRules = await window.actionclipSettings.getTagRules();
  renderTagRules();

  customRules = await window.actionclipSettings.getCustomRules();
  renderCustomRules();

  render();
  await renderHistory();

  s.addBtn.addEventListener('click', () => {
    templates.push({ id: `custom-${Date.now()}`, label: 'תבנית חדשה', text: '' });
    render();
  });
  s.saveTemplatesBtn.addEventListener('click', onSaveTemplates);
  s.resetBtn.addEventListener('click', onReset);
  s.saveSettingsBtn.addEventListener('click', onSaveSettings);
  if (s.saveQuietHoursBtn) s.saveQuietHoursBtn.addEventListener('click', onSaveQuietHours);
  s.saveDetectorsBtn.addEventListener('click', onSaveDetectors);
  s.saveClipHistorySettingsBtn.addEventListener('click', onSaveClipHistorySettings);
  s.clearClipHistoryBtn.addEventListener('click', onClearClipHistory);
  setupShortcutCapture('manual');
  setupShortcutCapture('history');
  setupShortcutCapture('historyFallback');
  s.saveShortcutsBtn.addEventListener('click', onSaveShortcuts);
  s.resetShortcutsBtn.addEventListener('click', onResetShortcuts);
  s.addTagRuleBtn.addEventListener('click', () => {
    tagRules.push({ id: `rule-${Date.now()}`, label: '', keywords: [] });
    renderTagRules();
  });
  s.saveTagRulesBtn.addEventListener('click', onSaveTagRules);
  s.addCustomRuleBtn.addEventListener('click', () => {
    customRules.push({ id: `rule-${Date.now()}`, label: '', pattern: '', urlTemplate: '', actionLabel: '', enabled: true });
    renderCustomRules();
  });
  s.saveCustomRulesBtn.addEventListener('click', onSaveCustomRules);
  s.saveActionPrefsBtn.addEventListener('click', onSaveActionPrefs);
  s.clearHistoryBtn.addEventListener('click', onClearHistory);
  s.exportCsvBtn.addEventListener('click', onExportCsv);

  // Language & theme toggles
  if (s.langToggleBtn) {
    s.langToggleBtn.addEventListener('click', () => {
      const cur = document.documentElement.lang || 'en';
      const next = cur === 'he' ? 'en' : 'he';
      applyAppLanguage(next);
      saveSetting('language', next);
    });
  }
  if (s.themeToggleBtn) {
    s.themeToggleBtn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = cur === 'dark' ? 'light' : 'dark';
      applyAppTheme(next);
      saveSetting('theme', next);
    });
  }
  document.querySelectorAll('#languageSeg .seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyAppLanguage(btn.dataset.val);
      saveSetting('language', btn.dataset.val);
    });
  });
  document.querySelectorAll('#themeSeg .seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyAppTheme(btn.dataset.val);
      saveSetting('theme', btn.dataset.val);
    });
  });
  document.getElementById('footerLang')?.addEventListener('click', () => {
    const cur = document.documentElement.lang || 'en';
    const next = cur === 'he' ? 'en' : 'he';
    applyAppLanguage(next);
    saveSetting('language', next);
  });

  // Lead settings
  s.leadChWhatsapp = document.getElementById('leadChWhatsapp');
  s.leadWhatsappNumber = document.getElementById('leadWhatsappNumber');
  s.leadWhatsappRow = document.getElementById('leadWhatsappRow');
  s.leadChWebhook = document.getElementById('leadChWebhook');
  s.leadWebhookRows = document.getElementById('leadWebhookRows');
  s.leadWebhookUrl = document.getElementById('leadWebhookUrl');
  s.leadWebhookHeaderName = document.getElementById('leadWebhookHeaderName');
  s.leadWebhookHeaderValue = document.getElementById('leadWebhookHeaderValue');
  s.leadChSlack = document.getElementById('leadChSlack');
  s.leadSlackRow = document.getElementById('leadSlackRow');
  s.leadSlackWebhookUrl = document.getElementById('leadSlackWebhookUrl');
  s.leadChEmail = document.getElementById('leadChEmail');
  s.leadEmailRow = document.getElementById('leadEmailRow');
  s.leadEmailAddress = document.getElementById('leadEmailAddress');
  s.leadChCopy = document.getElementById('leadChCopy');
  s.leadMessageTemplate = document.getElementById('leadMessageTemplate');
  s.leadAiEnabled = document.getElementById('leadAiEnabled');
  s.leadAiApiKey = document.getElementById('leadAiApiKey');
  s.leadAiKeyRow = document.getElementById('leadAiKeyRow');
  s.leadDupWindow = document.getElementById('leadDupWindow');
  s.leadCustomSources = document.getElementById('leadCustomSources');
  s.saveLeadSettingsBtn = document.getElementById('saveLeadSettingsBtn');
  s.savedLeadMsg = document.getElementById('savedLeadMsg');
  s.clearLeadHistoryBtn = document.getElementById('clearLeadHistoryBtn');
  s.exportLeadCsvBtn = document.getElementById('exportLeadCsvBtn');
  s.exportLeadMsg = document.getElementById('exportLeadMsg');
  s.leadHistoryList = document.getElementById('leadHistoryList');
  s.leadHistoryEmpty = document.getElementById('leadHistoryEmpty');

  const ls = await window.actionclipSettings.getLeadSettings();
  applyLeadSettings(ls);

  s.leadChWhatsapp.addEventListener('change', () => s.leadWhatsappRow.classList.toggle('hidden', !s.leadChWhatsapp.checked));
  s.leadChWebhook.addEventListener('change', () => s.leadWebhookRows.classList.toggle('hidden', !s.leadChWebhook.checked));
  s.leadChSlack.addEventListener('change', () => s.leadSlackRow.classList.toggle('hidden', !s.leadChSlack.checked));
  s.leadChEmail.addEventListener('change', () => s.leadEmailRow.classList.toggle('hidden', !s.leadChEmail.checked));
  s.leadAiEnabled.addEventListener('change', () => s.leadAiKeyRow.classList.toggle('hidden', !s.leadAiEnabled.checked));

  s.testWebhookBtn = document.getElementById('testWebhookBtn');
  s.testWebhookMsg = document.getElementById('testWebhookMsg');
  s.testSlackBtn = document.getElementById('testSlackBtn');
  s.testSlackMsg = document.getElementById('testSlackMsg');

  s.saveLeadSettingsBtn.addEventListener('click', onSaveLeadSettings);
  s.clearLeadHistoryBtn.addEventListener('click', onClearLeadHistory);
  s.exportLeadCsvBtn.addEventListener('click', onExportLeadCsv);
  s.testWebhookBtn.addEventListener('click', () => onTestChannel('webhook'));
  s.testSlackBtn.addEventListener('click', () => onTestChannel('slack'));

  // Esc closes the Settings window, same as every other ActionClip window/
  // popup — but not while a keyboard-shortcut field is actively capturing a
  // key combo (there, Escape is a candidate key for the shortcut itself).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.querySelector('.shortcut-input.capturing')) return;
    window.close();
  });

  await renderLeadHistory();
});

function setupTabs() {
  const buttons = document.querySelectorAll('.nav-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach((panel) => {
        panel.classList.toggle('active', panel.id === `tab-${btn.dataset.tab}`);
      });
    });
  });
}

function render() {
  s.list.replaceChildren();
  for (const t of templates) s.list.appendChild(buildCard(t));
  renderDefaultSelect();
}

function buildCard(template) {
  const card = document.createElement('div');
  card.className = 'card';

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.className = 'label-input';
  labelInput.value = template.label;
  labelInput.addEventListener('input', () => {
    template.label = labelInput.value;
    renderDefaultSelect();
  });

  const textArea = document.createElement('textarea');
  textArea.rows = 3;
  textArea.value = template.text;
  textArea.addEventListener('input', () => { template.text = textArea.value; });

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn danger small';
  removeBtn.textContent = 'מחק';
  removeBtn.addEventListener('click', () => {
    templates = templates.filter(t => t.id !== template.id);
    if (defaultId === template.id) defaultId = templates[0] ? templates[0].id : null;
    render();
  });

  const row = document.createElement('div');
  row.className = 'card-head';
  row.appendChild(labelInput);
  row.appendChild(removeBtn);

  card.appendChild(row);
  card.appendChild(textArea);
  return card;
}

function renderDefaultSelect() {
  s.defaultSelect.replaceChildren();
  for (const t of templates) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.label;
    s.defaultSelect.appendChild(opt);
  }
  if (templates.some(t => t.id === defaultId)) {
    s.defaultSelect.value = defaultId;
  } else if (templates[0]) {
    defaultId = templates[0].id;
    s.defaultSelect.value = defaultId;
  }
  s.defaultSelect.onchange = () => { defaultId = s.defaultSelect.value; };
}

function onSaveTemplates() {
  const cleaned = templates
    .map(t => ({ id: t.id, label: t.label.trim() || 'ללא שם', text: t.text }))
    .filter(t => t.text.trim().length > 0 || t.label.trim().length > 0);
  window.actionclipSettings.saveTemplates(cleaned, defaultId);
  flashSaved();
}

async function onReset() {
  if (!confirm('לאפס את כל התבניות לברירת המחדל? שינויים שלא נשמרו יאבדו.')) return;
  window.actionclipSettings.resetTemplates();
  const data = await window.actionclipSettings.getData();
  templates = data.templates.map(t => ({ ...t }));
  defaultId = data.defaultTemplateId;
  render();
  flashSaved();
}

function onSaveSettings() {
  window.actionclipSettings.saveSettings({
    enabled: s.enabledCheck.checked,
    autoLaunch: s.autoLaunchCheck.checked,
    startMinimized: s.startMinimizedCheck ? s.startMinimizedCheck.checked : false,
    closeToTray: s.closeToTrayCheck ? s.closeToTrayCheck.checked : true,
    showTrayNotification: s.showTrayNotificationCheck ? s.showTrayNotificationCheck.checked : true,
    soundOnDetect: s.soundOnDetectCheck ? s.soundOnDetectCheck.checked : false,
    startPaused: s.startPausedCheck ? s.startPausedCheck.checked : false,
    widgetEnabled: s.widgetEnabledCheck ? s.widgetEnabledCheck.checked : true,
    trayClickAction: s.trayClickSelect ? s.trayClickSelect.value : 'history',
    pollMs: Math.max(200, Number(s.pollInput.value) || 800),
    dedupeSeconds: Math.max(0, Number(s.dedupeInput.value) || 0),
    autoCloseSeconds: Math.max(0, Number(s.autoCloseInput.value) || 0),
    sendDedupeMinutes: Math.max(0, Number(s.sendDedupeInput.value) || 0)
  });
  flashMsg(s.savedSettingsMsg);
}

function onSaveQuietHours() {
  window.actionclipSettings.saveSettings({
    quietHours: {
      enabled: s.quietHoursEnabledCheck ? s.quietHoursEnabledCheck.checked : false,
      start: (s.quietHoursStartInput && s.quietHoursStartInput.value) || '18:00',
      end: (s.quietHoursEndInput && s.quietHoursEndInput.value) || '08:00'
    }
  });
  flashMsg(s.savedQuietHoursMsg);
}

function applyAppLanguage(lang) {
  if (typeof window.i18n === 'undefined') return;
  window.i18n.applyI18n(lang);
  // Update segmented controls
  document.querySelectorAll('#languageSeg .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.val === lang));
  // Update header pill text
  if (s.langToggleBtn) s.langToggleBtn.textContent = lang === 'he' ? '🌐 EN' : '🌐 עב';
}

function applyAppTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // Update segmented controls
  document.querySelectorAll('#themeSeg .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.val === theme));
  // Update header pill
  if (s.themeToggleBtn) s.themeToggleBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
}

function saveSetting(key, value) {
  window.actionclipSettings.saveSettings({ [key]: value });
}

function onSaveDetectors() {
  window.actionclipSettings.saveSettings({
    detectors: {
      phone: s.detectPhoneCheck.checked,
      tracking: s.detectTrackingCheck.checked,
      address: s.detectAddressCheck.checked,
      url: s.detectUrlCheck.checked,
      email: s.detectEmailCheck.checked,
      datetime: s.detectDatetimeCheck.checked
    }
  });
  s.savedDetectorsMsg.classList.remove('hidden');
  setTimeout(() => s.savedDetectorsMsg.classList.add('hidden'), 1800);
}

function onSaveClipHistorySettings() {
  window.actionclipSettings.saveSettings({
    historyEnabled: s.clipHistoryEnabledCheck.checked,
    historyStorageLimit: Math.max(50, Math.min(5000, Number(s.clipHistoryStorageInput.value) || 1000)),
    historyPreviewLimit: Math.max(10, Math.min(200, Number(s.clipHistoryPreviewInput.value) || 50))
  });
  s.savedClipHistoryMsg.classList.remove('hidden');
  setTimeout(() => s.savedClipHistoryMsg.classList.add('hidden'), 1800);
}

function onClearClipHistory() {
  window.actionclipSettings.clearClipboardHistory();
  s.savedClipHistoryMsg.textContent = 'נוקה ✓';
  s.savedClipHistoryMsg.classList.remove('hidden');
  setTimeout(() => {
    s.savedClipHistoryMsg.classList.add('hidden');
    s.savedClipHistoryMsg.textContent = 'נשמר ✓';
  }, 1800);
}

function onSaveActionPrefs() {
  window.actionclipSettings.saveSettings({
    actionPreferences: {
      phone: s.prefPhoneSelect.value,
      address: s.prefAddressSelect.value,
      tracking: s.prefTrackingSelect.value,
      email: s.prefEmailSelect.value
    },
    autoRunAction: s.autoRunCheck.checked,
    autoRunDelaySeconds: Math.max(1, Math.min(30, Number(s.autoRunDelayInput.value) || 4))
  });
  s.savedActionPrefsMsg.classList.remove('hidden');
  setTimeout(() => s.savedActionPrefsMsg.classList.add('hidden'), 1800);
}

async function renderHistory() {
  const history = await window.actionclipSettings.getHistory();
  s.historyList.replaceChildren();
  s.historyEmpty.classList.toggle('hidden', history.length > 0);
  for (const entry of history) {
    const row = document.createElement('div');
    row.className = 'history-row';

    const who = document.createElement('div');
    who.className = 'who';
    const phone = document.createElement('span');
    phone.className = 'phone';
    phone.textContent = entry.display || entry.normalized || '';
    who.appendChild(phone);
    if (entry.name) {
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = entry.name;
      who.appendChild(name);
    }

    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `${entry.templateLabel || ''} · ${timeAgoLabel(entry.sentAt)}`;

    row.appendChild(who);
    row.appendChild(meta);
    s.historyList.appendChild(row);
  }
}

async function onClearHistory() {
  window.actionclipSettings.clearHistory();
  await renderHistory();
}

async function onExportCsv() {
  const result = await window.actionclipSettings.exportHistoryCsv();
  if (result.canceled) return;
  s.exportMsg.textContent = `יוצא בהצלחה: ${result.filePath}`;
  s.exportMsg.classList.remove('hidden');
  setTimeout(() => s.exportMsg.classList.add('hidden'), 4000);
}

function flashMsg(el) {
  if (!el) return;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 1800);
}

function flashSaved() { flashMsg(s.savedMsg); }

// ─── Lead settings ────────────────────────────────────────────────────────────

function applyLeadSettings(ls) {
  s.leadChWhatsapp.checked = !!ls.channelWhatsapp;
  s.leadWhatsappNumber.value = ls.whatsappNumber || '';
  s.leadWhatsappRow.classList.toggle('hidden', !ls.channelWhatsapp);

  s.leadChWebhook.checked = !!ls.channelWebhook;
  s.leadWebhookUrl.value = ls.webhookUrl || '';
  s.leadWebhookHeaderName.value = ls.webhookHeaderName || '';
  s.leadWebhookHeaderValue.value = ls.webhookHeaderValue || '';
  s.leadWebhookRows.classList.toggle('hidden', !ls.channelWebhook);

  s.leadChSlack.checked = !!ls.channelSlack;
  s.leadSlackWebhookUrl.value = ls.slackWebhookUrl || '';
  s.leadSlackRow.classList.toggle('hidden', !ls.channelSlack);

  s.leadChEmail.checked = !!ls.channelEmail;
  s.leadEmailAddress.value = ls.emailAddress || '';
  s.leadEmailRow.classList.toggle('hidden', !ls.channelEmail);

  s.leadChCopy.checked = !!ls.channelCopy;
  s.leadMessageTemplate.value = ls.messageTemplate || '';
  s.leadAiEnabled.checked = !!ls.aiEnabled;
  s.leadAiApiKey.value = ls.aiApiKey || '';
  s.leadAiKeyRow.classList.toggle('hidden', !ls.aiEnabled);
  s.leadDupWindow.value = ls.duplicateWindowHours || 6;
  s.leadCustomSources.value = (ls.customSources || []).join(', ');
}

function onSaveLeadSettings() {
  const settings = {
    channelWhatsapp: s.leadChWhatsapp.checked,
    whatsappNumber: s.leadWhatsappNumber.value.trim(),
    channelWebhook: s.leadChWebhook.checked,
    webhookUrl: s.leadWebhookUrl.value.trim(),
    webhookHeaderName: s.leadWebhookHeaderName.value.trim(),
    webhookHeaderValue: s.leadWebhookHeaderValue.value.trim(),
    channelSlack: s.leadChSlack.checked,
    slackWebhookUrl: s.leadSlackWebhookUrl.value.trim(),
    channelEmail: s.leadChEmail.checked,
    emailAddress: s.leadEmailAddress.value.trim(),
    channelCopy: s.leadChCopy.checked,
    messageTemplate: s.leadMessageTemplate.value,
    aiEnabled: s.leadAiEnabled.checked,
    aiApiKey: s.leadAiApiKey.value.trim(),
    duplicateWindowHours: parseInt(s.leadDupWindow.value, 10) || 6,
    customSources: s.leadCustomSources.value.split(',').map((x) => x.trim()).filter(Boolean)
  };
  window.actionclipSettings.saveLeadSettings(settings);
  s.savedLeadMsg.classList.remove('hidden');
  setTimeout(() => s.savedLeadMsg.classList.add('hidden'), 1800);
}

async function onClearLeadHistory() {
  window.actionclipSettings.clearLeadHistory();
  await renderLeadHistory();
}

async function onExportLeadCsv() {
  s.exportLeadCsvBtn.disabled = true;
  try {
    const result = await window.actionclipSettings.exportLeadHistoryCsv();
    if (!result.canceled) {
      s.exportLeadMsg.textContent = 'הקובץ נשמר ✓';
      s.exportLeadMsg.className = 'saved-msg';
      s.exportLeadMsg.classList.remove('hidden');
      setTimeout(() => s.exportLeadMsg.classList.add('hidden'), 2500);
    }
  } catch (e) {
    s.exportLeadMsg.textContent = 'שגיאה בייצוא';
    s.exportLeadMsg.className = 'saved-msg error';
    s.exportLeadMsg.classList.remove('hidden');
    setTimeout(() => s.exportLeadMsg.classList.add('hidden'), 2500);
  } finally {
    s.exportLeadCsvBtn.disabled = false;
  }
}

async function onTestChannel(channel) {
  const btn = channel === 'webhook' ? s.testWebhookBtn : s.testSlackBtn;
  const msgEl = channel === 'webhook' ? s.testWebhookMsg : s.testSlackMsg;
  btn.disabled = true;
  btn.textContent = '⏳ בודק...';
  try {
    const url = channel === 'webhook' ? s.leadWebhookUrl.value.trim() : s.leadSlackWebhookUrl.value.trim();
    if (!url) { showTestResult(btn, msgEl, false, 'נדרש URL'); return; }
    const result = await window.actionclipSettings.testLeadChannel({ channel, url,
      headerName: channel === 'webhook' ? s.leadWebhookHeaderName.value.trim() : '',
      headerValue: channel === 'webhook' ? s.leadWebhookHeaderValue.value.trim() : '' });
    showTestResult(btn, msgEl, result.ok, result.ok ? 'חיבור תקין ✓' : (result.error || 'שגיאה'));
  } catch (e) {
    showTestResult(btn, msgEl, false, 'שגיאה');
  }
}

function showTestResult(btn, msgEl, ok, text) {
  btn.disabled = false;
  btn.textContent = '🔗 בדוק חיבור';
  msgEl.textContent = text;
  msgEl.className = 'saved-msg ' + (ok ? '' : 'error');
  msgEl.classList.remove('hidden');
  setTimeout(() => msgEl.classList.add('hidden'), 3000);
}

async function renderLeadHistory() {
  const history = await window.actionclipSettings.getLeadHistory();
  s.leadHistoryList.replaceChildren();
  if (!history || !history.length) {
    s.leadHistoryEmpty.classList.remove('hidden');
    return;
  }
  s.leadHistoryEmpty.classList.add('hidden');
  for (const item of history) {
    const row = document.createElement('div');
    row.className = 'history-row';
    const d = new Date(item.sentAt);
    const fields = [item.phone, item.name, item.role, item.source, item.channel || '', d.toLocaleString('he-IL')];
    const classes = ['history-phone', 'history-name', 'history-role', 'history-source', 'history-channel', 'history-date'];
    fields.forEach((text, i) => {
      const span = document.createElement('span');
      span.className = classes[i];
      span.textContent = text || '';
      row.appendChild(span);
    });
    s.leadHistoryList.appendChild(row);
  }
}
