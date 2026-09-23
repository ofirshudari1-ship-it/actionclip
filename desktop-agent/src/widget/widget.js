// widget.js — renderer for the persistent desktop widget. Talks to main.js
// only through window.actionclipWidget (see preload.js) — no Node/Electron
// access in this process (contextIsolation + sandbox, matching every other
// window in this app).
//
// Privacy: the payload from main (buildWidgetState in lib/window-behavior.js)
// carries only monitoring state, UI language and the *category* + time of the
// latest detected action — never clipboard text. Labels are localized here.

const CATEGORY_ICON = { phone: '📞', tracking: '📦', address: '🗺️', url: '🔗', email: '✉️', custom: '⚡', text: '📋' };

let lastData = null;
let tickTimer = null;
let toggleInFlight = false;

function tr(key, vars) {
  const lang = (lastData && lastData.language) || 'en';
  let str = window.i18n.t(lang, key);
  for (const [k, v] of Object.entries(vars || {})) str = str.replace(`{${k}}`, String(v));
  return str;
}

function timeAgoLabel(timestamp) {
  const { unit, n } = window.actionclipWindowBehavior.timeAgoBucket(timestamp);
  return tr(`widget.time.${unit}`, { n });
}

function render() {
  if (!lastData) return;

  // Language + direction first (sets <html lang/dir> and every data-i18n
  // node), so the widget mirrors correctly and follows Settings live.
  window.i18n.applyI18n(lastData.language);
  const closeBtn = document.getElementById('closeBtn');
  closeBtn.setAttribute('aria-label', tr('widget.hide'));

  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  const toggleBtn = document.getElementById('toggleBtn');

  dot.classList.toggle('paused', !lastData.enabled);
  text.textContent = tr(lastData.enabled ? 'widget.status.active' : 'widget.status.paused');
  document.getElementById('toggleIcon').textContent = lastData.enabled ? '⏸' : '▶';
  document.getElementById('toggleLabel').textContent = tr(lastData.enabled ? 'widget.pause' : 'widget.resume');
  toggleBtn.disabled = toggleInFlight;

  const recentRow = document.getElementById('recentRow');
  if (lastData.recent) {
    const category = lastData.recent.category;
    document.getElementById('recentIcon').textContent = CATEGORY_ICON[category] || '📋';
    const label = window.i18n.STRINGS[lastData.language] && window.i18n.STRINGS[lastData.language][`widget.cat.${category}`]
      ? tr(`widget.cat.${category}`)
      : tr('widget.cat.custom');
    document.getElementById('recentText').textContent =
      tr('widget.recent', { label, time: timeAgoLabel(lastData.recent.copiedAt) });
    recentRow.classList.remove('hidden');
  } else {
    recentRow.classList.add('hidden');
  }
}

async function loadData() {
  try {
    lastData = await window.actionclipWidget.getData();
    render();
  } catch (_) {
    // window may be closing mid-request — nothing to do
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadData();

  // Keeps the "X min ago" text moving forward, and is a lightweight safety
  // net in case a push update (widget:state-changed) is ever missed.
  tickTimer = setInterval(loadData, 20000);

  document.getElementById('toggleBtn').addEventListener('click', async () => {
    if (toggleInFlight) return; // resuming awaits a clipboard read in main - ignore double clicks
    toggleInFlight = true;
    render();
    try {
      const enabled = await window.actionclipWidget.toggleMonitoring();
      if (lastData) lastData.enabled = enabled;
    } finally {
      toggleInFlight = false;
      render();
    }
  });

  document.getElementById('historyBtn').addEventListener('click', () => {
    window.actionclipWidget.openHistory();
  });

  document.getElementById('closeBtn').addEventListener('click', () => {
    window.actionclipWidget.hide();
  });

  window.actionclipWidget.onStateChanged(() => loadData());
});

window.addEventListener('beforeunload', () => {
  if (tickTimer) clearInterval(tickTimer);
});
