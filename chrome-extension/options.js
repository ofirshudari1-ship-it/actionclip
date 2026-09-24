let ocTemplates = [];
let ocDefaultId = null;

const oc = {};

document.addEventListener('DOMContentLoaded', async () => {
  oc.list = document.getElementById('list');
  oc.addBtn = document.getElementById('addBtn');
  oc.defaultSelect = document.getElementById('defaultSelect');
  oc.saveBtn = document.getElementById('saveBtn');
  oc.resetBtn = document.getElementById('resetBtn');
  oc.savedMsg = document.getElementById('savedMsg');
  oc.dedupeInput = document.getElementById('dedupeInput');
  oc.saveSettingsBtn = document.getElementById('saveSettingsBtn');
  oc.historyList = document.getElementById('historyList');
  oc.historyEmpty = document.getElementById('historyEmpty');
  oc.clearHistoryBtn = document.getElementById('clearHistoryBtn');
  oc.exportCsvBtn = document.getElementById('exportCsvBtn');
  oc.versionLabel = document.getElementById('versionLabel');

  setupTabs();

  const manifest = chrome.runtime.getManifest();
  oc.versionLabel.textContent = manifest.version ? `v${manifest.version}` : '';

  const { templates, defaultTemplateId } = await pcLoadTemplates();
  ocTemplates = templates.map(t => ({ ...t }));
  ocDefaultId = defaultTemplateId;
  render();

  const settings = await pcLoadSettings();
  oc.dedupeInput.value = settings.dedupeMinutes;

  await renderHistory();

  oc.addBtn.addEventListener('click', () => {
    ocTemplates.push({ id: `custom-${Date.now()}`, label: 'תבנית חדשה', text: '' });
    render();
  });
  oc.saveBtn.addEventListener('click', onSave);
  oc.resetBtn.addEventListener('click', onReset);
  oc.saveSettingsBtn.addEventListener('click', onSaveSettings);
  oc.clearHistoryBtn.addEventListener('click', onClearHistory);
  oc.exportCsvBtn.addEventListener('click', onExportCsv);
});

function setupTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach((panel) => {
        panel.classList.toggle('hidden', panel.id !== `tab-${btn.dataset.tab}`);
      });
    });
  });
}

function render() {
  oc.list.replaceChildren();
  for (const t of ocTemplates) {
    oc.list.appendChild(buildCard(t));
  }
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
    ocTemplates = ocTemplates.filter(t => t.id !== template.id);
    if (ocDefaultId === template.id) ocDefaultId = ocTemplates[0] ? ocTemplates[0].id : null;
    render();
  });

  const row = document.createElement('div');
  row.className = 'card-row';
  row.appendChild(labelInput);
  row.appendChild(removeBtn);

  card.appendChild(row);
  card.appendChild(textArea);
  return card;
}

function renderDefaultSelect() {
  oc.defaultSelect.replaceChildren();
  for (const t of ocTemplates) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.label;
    oc.defaultSelect.appendChild(opt);
  }
  if (ocTemplates.some(t => t.id === ocDefaultId)) {
    oc.defaultSelect.value = ocDefaultId;
  } else if (ocTemplates[0]) {
    ocDefaultId = ocTemplates[0].id;
    oc.defaultSelect.value = ocDefaultId;
  }
  oc.defaultSelect.onchange = () => { ocDefaultId = oc.defaultSelect.value; };
}

async function onSave() {
  const cleaned = ocTemplates
    .map(t => ({ id: t.id, label: t.label.trim() || 'ללא שם', text: t.text }))
    .filter(t => t.text.trim().length > 0 || t.label.trim().length > 0);
  await pcSaveTemplates(cleaned, ocDefaultId);
  flashSaved(oc.savedMsg);
}

async function onReset() {
  ocTemplates = DEFAULT_TEMPLATES.map(t => ({ ...t }));
  ocDefaultId = ocTemplates[0].id;
  render();
  await pcSaveTemplates(ocTemplates, ocDefaultId);
  flashSaved(oc.savedMsg);
}

async function onSaveSettings() {
  await pcSaveSettings({ dedupeMinutes: Math.max(0, Number(oc.dedupeInput.value) || 0) });
  flashSaved(oc.savedMsg);
}

async function renderHistory() {
  const history = await pcLoadHistory();
  oc.historyList.replaceChildren();
  oc.historyEmpty.classList.toggle('hidden', history.length > 0);
  for (const entry of history) {
    const row = document.createElement('div');
    row.className = 'history-row';

    const who = document.createElement('div');
    who.className = 'who';
    const phone = document.createElement('span');
    phone.className = 'phone';
    phone.textContent = entry.display || entry.normalized;
    who.appendChild(phone);
    if (entry.name) {
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = entry.name;
      who.appendChild(name);
    }

    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `${entry.templateLabel || ''} · ${pcTimeAgoLabel(entry.sentAt)}`;

    row.appendChild(who);
    row.appendChild(meta);
    oc.historyList.appendChild(row);
  }
}

async function onClearHistory() {
  await pcClearHistory();
  await renderHistory();
}

function csvEscape(value) {
  const s = String(value == null ? '' : value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildHistoryCsv(history) {
  const header = ['מספר', 'שם', 'תבנית', 'תאריך ושעה'];
  const rows = history.map((h) => [
    h.display || h.normalized,
    h.name || '',
    h.templateLabel || '',
    new Date(h.sentAt).toLocaleString('he-IL')
  ]);
  return [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n');
}

async function onExportCsv() {
  const history = await pcLoadHistory();
  const csv = '﻿' + buildHistoryCsv(history); // BOM so Excel reads Hebrew correctly
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tapact-history-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function flashSaved(el) {
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 1800);
}
