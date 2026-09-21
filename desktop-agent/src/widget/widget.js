// widget.js — renderer for the persistent desktop widget. Talks to main.js
// only through window.actionclipWidget (see preload.js) — no Node/Electron
// access in this process (contextIsolation + sandbox, matching every other
// window in this app).

let lastData = null;
let tickTimer = null;

function timeAgoLabel(timestamp) {
  const mins = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (mins < 1) return 'הרגע';
  if (mins < 60) return `לפני ${mins} דק'`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `לפני ${hours} שע'`;
  return `לפני ${Math.round(hours / 24)} ימים`;
}

function render() {
  if (!lastData) return;

  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  const toggleBtn = document.getElementById('toggleBtn');

  if (lastData.enabled) {
    dot.classList.remove('paused');
    text.textContent = 'ניטור פעיל';
    toggleBtn.textContent = '⏸ השהה';
  } else {
    dot.classList.add('paused');
    text.textContent = 'ניטור מושהה';
    toggleBtn.textContent = '▶ המשך';
  }

  const recentRow = document.getElementById('recentRow');
  if (lastData.recent) {
    document.getElementById('recentIcon').textContent = lastData.recent.icon || '📋';
    document.getElementById('recentText').textContent =
      `${lastData.recent.label} זוהה ${timeAgoLabel(lastData.recent.copiedAt)}`;
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
    const enabled = await window.actionclipWidget.toggleMonitoring();
    if (lastData) lastData.enabled = enabled;
    render();
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
