const CATEGORY_ICON = {
  phone: '📞',
  tracking: '📦',
  address: '🗺️',
  url: '🔗',
  email: '✉️',
  custom: '⚡',
  text: '📋'
};

let items = [];
let total = 0;
let pageSize = 50;
let historyEnabled = true;
let activeCategory = 'all';
let searchTerm = '';
let lang = 'en';

const els = {};

// True when this page is loaded as the BrowserView embedded inside Settings
// ▸ היסטוריית לוח (see main.js's getHistoryEmbedView) rather than as the
// standalone quick-access popup (openHistoryWindow). The two share this
// exact same HTML/JS/preload - only the chrome differs: the embedded view
// lives inside a window that already has its own title bar and tab nav, so
// its own "✕" close button (which only makes sense for the frameless
// standalone popup) would otherwise sit there doing nothing.
const isEmbedded = new URLSearchParams(location.search).get('embedded') === '1';

document.addEventListener('DOMContentLoaded', async () => {
  els.list = document.getElementById('list');
  els.emptyState = document.getElementById('emptyState');
  els.emptyStateText = document.getElementById('emptyStateText');
  els.searchInput = document.getElementById('searchInput');
  els.filters = document.getElementById('filters');
  els.closeBtn = document.getElementById('closeBtn');
  els.clearBtn = document.getElementById('clearBtn');
  els.toggleBtn = document.getElementById('toggleBtn');
  els.pauseDot = document.getElementById('pauseDot');
  els.statusText = document.getElementById('statusText');
  els.countLabel = document.getElementById('countLabel');

  document.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c.classList.contains('active'))));

  if (isEmbedded) {
    document.body.classList.add('embedded');
    els.closeBtn.style.display = 'none';
  }

  await load();
  render();

  els.searchInput.focus();
  els.searchInput.addEventListener('input', () => {
    searchTerm = els.searchInput.value.trim().toLowerCase();
    render();
  });

  els.filters.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    activeCategory = btn.dataset.cat;
    document.querySelectorAll('.chip').forEach((c) => {
      c.classList.toggle('active', c === btn);
      c.setAttribute('aria-pressed', String(c === btn)); // selected filter, for screen readers
    });
    render();
  });

  els.closeBtn.addEventListener('click', () => window.actionclipHistory.dismiss());
  els.clearBtn.addEventListener('click', () => {
    window.actionclipHistory.clearAll();
    items = [];
    total = 0;
    render();
  });

  els.toggleBtn.addEventListener('click', () => {
    historyEnabled = !historyEnabled;
    window.actionclipHistory.toggleEnabled(historyEnabled);
    updateStatus();
  });

  window.actionclipHistory.onItemsChanged(async () => {
    await load();
    render();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !isEmbedded) window.actionclipHistory.dismiss();
  });
});

async function load(limit) {
  const data = await window.actionclipHistory.getData(limit);
  items = data.items || [];
  total = data.total || items.length;
  pageSize = limit || items.length || 50;
  historyEnabled = data.historyEnabled !== false;

  // Follow the UI language, same as every other window (§4).
  if (typeof window.i18n !== 'undefined') {
    lang = (data.settings && data.settings.language) || 'en';
    window.i18n.applyI18n(lang);
  }

  updateStatus();
}

function updateStatus() {
  const t = (key) => window.i18n ? window.i18n.t(lang, key) : key;
  els.pauseDot.classList.toggle('paused', !historyEnabled);
  els.statusText.textContent = historyEnabled ? t('clip.panel.recording') : t('clip.panel.paused');
  els.toggleBtn.textContent = historyEnabled ? t('clip.pause') : t('clip.resume');
}

function timeAgoLabel(timestamp) {
  const t = (key) => window.i18n ? window.i18n.t(lang, key) : key;
  const mins = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (mins < 1) return t('clip.time.now');
  if (mins < 60) return t('clip.time.min').replace('{n}', mins);
  const hours = Math.round(mins / 60);
  if (hours < 24) return t('clip.time.hour').replace('{n}', hours);
  return t('clip.time.day').replace('{n}', Math.round(hours / 24));
}

function fullDateLabel(timestamp) {
  return new Date(timestamp).toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function matchesSearch(item, term) {
  if (!term) return true;
  if (item.text.toLowerCase().includes(term)) return true;
  return (item.tags || []).some((t) => t.toLowerCase().includes(term));
}

function render() {
  const t = (key) => window.i18n ? window.i18n.t(lang, key) : key;
  const filtered = items.filter((item) => {
    if (activeCategory !== 'all' && item.category !== activeCategory) return false;
    if (!matchesSearch(item, searchTerm)) return false;
    return true;
  });

  els.list.replaceChildren();
  els.emptyState.classList.toggle('hidden', filtered.length > 0);
  if (filtered.length === 0) {
    const isFiltered = Boolean(searchTerm) || activeCategory !== 'all';
    els.emptyStateText.textContent = isFiltered
      ? t('clip.panel.emptyFiltered')
      : t('clip.panel.empty');
  }
  els.countLabel.textContent = total > items.length
    ? t('clip.panel.countShowing').replace('{shown}', items.length).replace('{total}', total)
    : t('clip.panel.countTotal').replace('{n}', total);

  for (const item of filtered) {
    els.list.appendChild(buildRow(item));
  }

  if (items.length < total && !searchTerm && activeCategory === 'all') {
    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.className = 'load-more';
    loadMoreBtn.textContent = t('clip.panel.loadMore').replace('{n}', total - items.length);
    loadMoreBtn.addEventListener('click', async () => {
      await load(pageSize + 50);
      render();
    });
    els.list.appendChild(loadMoreBtn);
  }
}

function buildRow(item) {
  const row = document.createElement('div');
  row.className = 'item';
  // Keyboard-operable, not just clickable: Tab reaches the row, Enter/Space
  // copies it — matching what a mouse click does (see keydown handler below).
  row.tabIndex = 0;
  row.setAttribute('role', 'button');
  row.setAttribute('aria-label', item.text);

  const icon = document.createElement('span');
  icon.className = 'icon';
  icon.textContent = CATEGORY_ICON[item.category] || '📋';

  const content = document.createElement('div');
  content.className = 'content';
  const text = document.createElement('div');
  text.className = 'text';
  text.textContent = item.text;
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.title = fullDateLabel(item.copiedAt);
  meta.textContent = `${timeAgoLabel(item.copiedAt)} · ${fullDateLabel(item.copiedAt)}`;
  content.appendChild(text);
  content.appendChild(meta);

  if (item.tags && item.tags.length) {
    const tagsRow = document.createElement('div');
    tagsRow.className = 'tags-row';
    for (const tag of item.tags) {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.textContent = tag;
      tagsRow.appendChild(chip);
    }
    content.appendChild(tagsRow);
  }

  const actions = document.createElement('div');
  actions.className = 'item-actions';

  if (item.actions && item.actions.length) {
    const goBtn = document.createElement('button');
    goBtn.className = 'go';
    goBtn.title = item.actions[0].label;
    goBtn.setAttribute('aria-label', item.actions[0].label);
    goBtn.textContent = '▶';
    goBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.actionclipHistory.runAction(item.id, 0);
    });
    actions.appendChild(goBtn);
  }

  const delBtn = document.createElement('button');
  const deleteLabel = window.i18n ? window.i18n.t(lang, 'clip.panel.delete') : 'Delete';
  delBtn.title = deleteLabel;
  delBtn.setAttribute('aria-label', deleteLabel);
  delBtn.textContent = '✕';
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.actionclipHistory.deleteItem(item.id);
    items = items.filter((i) => i.id !== item.id);
    total = Math.max(0, total - 1);
    render();
  });
  actions.appendChild(delBtn);

  row.appendChild(icon);
  row.appendChild(content);
  row.appendChild(actions);

  row.addEventListener('click', () => window.actionclipHistory.copyItem(item.id));
  row.addEventListener('keydown', (e) => {
    if (e.target !== row) return; // let the go/delete buttons handle their own Enter/Space
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault(); // Space must not also scroll the list
    window.actionclipHistory.copyItem(item.id);
  });

  return row;
}
