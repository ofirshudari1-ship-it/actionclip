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

const els = {};

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
    document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === btn));
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
    if (e.key === 'Escape') window.actionclipHistory.dismiss();
  });
});

async function load(limit) {
  const data = await window.actionclipHistory.getData(limit);
  items = data.items || [];
  total = data.total || items.length;
  pageSize = limit || items.length || 50;
  historyEnabled = data.historyEnabled !== false;
  updateStatus();
}

function updateStatus() {
  els.pauseDot.classList.toggle('paused', !historyEnabled);
  els.statusText.textContent = historyEnabled ? 'מקליט' : 'מושהה';
  els.toggleBtn.textContent = historyEnabled ? 'השהה' : 'המשך';
}

function timeAgoLabel(timestamp) {
  const mins = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (mins < 1) return 'עכשיו';
  if (mins < 60) return `לפני ${mins} דק'`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `לפני ${hours} שע'`;
  return `לפני ${Math.round(hours / 24)} ימים`;
}

function fullDateLabel(timestamp) {
  return new Date(timestamp).toLocaleString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function matchesSearch(item, term) {
  if (!term) return true;
  if (item.text.toLowerCase().includes(term)) return true;
  return (item.tags || []).some((t) => t.toLowerCase().includes(term));
}

function render() {
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
      ? 'לא נמצאו תוצאות תואמות'
      : 'אין עדיין העתקות בהיסטוריה';
  }
  els.countLabel.textContent = total > items.length
    ? `מציג ${items.length} מתוך ${total}`
    : `${total} פריטים`;

  for (const item of filtered) {
    els.list.appendChild(buildRow(item));
  }

  if (items.length < total && !searchTerm && activeCategory === 'all') {
    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.className = 'load-more';
    loadMoreBtn.textContent = `טען עוד (${total - items.length} נוספים)`;
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
    goBtn.textContent = '▶';
    goBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.actionclipHistory.runAction(item.id, 0);
    });
    actions.appendChild(goBtn);
  }

  const delBtn = document.createElement('button');
  delBtn.title = 'מחק';
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

  return row;
}
