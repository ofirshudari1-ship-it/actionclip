document.addEventListener('DOMContentLoaded', async () => {
  const titleLabel = document.getElementById('titleLabel');
  const detectLabel = document.getElementById('detectLabel');
  const detectValue = document.getElementById('detectValue');
  const actionsList = document.getElementById('actionsList');
  const settingsBtn = document.getElementById('settingsBtn');
  const closeBtn = document.getElementById('closeBtn');

  const data = await window.actionclipAction.getInitData();
  const action = data && data.action;

  if (action) {
    titleLabel.textContent = '📎 ActionClip';
    detectLabel.textContent = action.title || 'זוהה';
    detectValue.textContent = action.display || action.raw || '';
    detectValue.title = action.raw || '';

    (action.actions || []).forEach((a, index) => {
      const btn = document.createElement('button');
      btn.className = index === 0 ? 'btn primary' : 'btn secondary';
      btn.textContent = a.label;
      btn.addEventListener('click', () => window.actionclipAction.runAction(index));
      actionsList.appendChild(btn);
    });
  }

  settingsBtn.addEventListener('click', () => window.actionclipAction.openSettings());
  closeBtn.addEventListener('click', () => window.actionclipAction.dismiss());

  // Esc dismisses the popup, same as every other ActionClip window/popup.
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.actionclipAction.dismiss(); });

  ['keydown', 'click'].forEach((evt) =>
    document.addEventListener(evt, () => window.actionclipAction.notifyActivity())
  );
});
