let pcState = {
  phone: null, // { raw, normalized, display }
  templates: [],
  selectedTemplateId: null,
  settings: null,
  history: []
};

const els = {};

document.addEventListener('DOMContentLoaded', async () => {
  els.phoneFoundBlock = document.getElementById('phoneFoundBlock');
  els.phoneMissingBlock = document.getElementById('phoneMissingBlock');
  els.phoneDisplay = document.getElementById('phoneDisplay');
  els.manualPhone = document.getElementById('manualPhone');
  els.checkManualBtn = document.getElementById('checkManualBtn');
  els.dupWarningBlock = document.getElementById('dupWarningBlock');
  els.dupWarningText = document.getElementById('dupWarningText');
  els.nameInput = document.getElementById('nameInput');
  els.templateSelect = document.getElementById('templateSelect');
  els.messageArea = document.getElementById('messageArea');
  els.sendBtn = document.getElementById('sendBtn');
  els.settingsBtn = document.getElementById('settingsBtn');

  const [{ templates, defaultTemplateId }, settings, history] = await Promise.all([
    pcLoadTemplates(),
    pcLoadSettings(),
    pcLoadHistory()
  ]);
  pcState.templates = templates;
  pcState.selectedTemplateId = defaultTemplateId;
  pcState.settings = settings;
  pcState.history = history;
  renderTemplateOptions();

  els.templateSelect.addEventListener('change', () => {
    pcState.selectedTemplateId = els.templateSelect.value;
    refreshMessage();
  });
  els.nameInput.addEventListener('input', refreshMessage);
  els.checkManualBtn.addEventListener('click', () => {
    tryUsePhoneFromText(els.manualPhone.value);
  });
  els.manualPhone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryUsePhoneFromText(els.manualPhone.value);
  });
  els.sendBtn.addEventListener('click', onSend);
  els.settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

  await detectFromClipboard();
});

function renderTemplateOptions() {
  els.templateSelect.innerHTML = '';
  for (const t of pcState.templates) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.label;
    els.templateSelect.appendChild(opt);
  }
  els.templateSelect.value = pcState.selectedTemplateId;
}

async function detectFromClipboard() {
  let text = '';
  try {
    text = await navigator.clipboard.readText();
  } catch (err) {
    // Clipboard read blocked (permissions/focus) - fall back to manual entry silently.
    text = '';
  }
  tryUsePhoneFromText(text);
}

function tryUsePhoneFromText(text) {
  const found = pcFindPhone(text);
  if (found) {
    pcState.phone = found;
    els.phoneDisplay.textContent = found.display;
    els.phoneFoundBlock.classList.remove('hidden');
    els.phoneMissingBlock.classList.add('hidden');
    els.sendBtn.disabled = false;
    els.nameInput.focus();
  } else {
    pcState.phone = null;
    els.phoneFoundBlock.classList.add('hidden');
    els.phoneMissingBlock.classList.remove('hidden');
    els.sendBtn.disabled = true;
    els.manualPhone.focus();
    els.manualPhone.select();
  }
  refreshDupWarning();
  refreshMessage();
}

function refreshDupWarning() {
  if (!pcState.phone) {
    els.dupWarningBlock.classList.add('hidden');
    return;
  }
  const recent = pcFindRecentSend(pcState.history, pcState.phone.normalized, pcState.settings.dedupeMinutes);
  if (recent) {
    els.dupWarningText.textContent = `כבר נשלחה הודעה למספר הזה ${pcTimeAgoLabel(recent.sentAt)}${recent.name ? ' (' + recent.name + ')' : ''}. אפשר לשלוח שוב אם צריך.`;
    els.dupWarningBlock.classList.remove('hidden');
  } else {
    els.dupWarningBlock.classList.add('hidden');
  }
}

function refreshMessage() {
  const template = pcState.templates.find(t => t.id === pcState.selectedTemplateId) || pcState.templates[0];
  if (!template) return;
  els.messageArea.value = pcFillTemplate(template.text, els.nameInput.value);
}

async function onSend() {
  if (!pcState.phone) return;
  const template = pcState.templates.find(t => t.id === pcState.selectedTemplateId) || pcState.templates[0];
  const url = pcBuildWhatsAppUrl(pcState.phone.normalized, els.messageArea.value);
  await pcAddHistoryEntry({
    normalized: pcState.phone.normalized,
    display: pcState.phone.display,
    name: els.nameInput.value.trim(),
    templateLabel: template ? template.label : ''
  });
  chrome.tabs.create({ url });
  window.close();
}
