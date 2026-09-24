document.addEventListener('DOMContentLoaded', () => {
  const steps = Array.from(document.querySelectorAll('.step'));
  const dotsEl = document.getElementById('dotsEl') || document.getElementById('dots');
  const backBtn = document.getElementById('backBtn');
  const nextBtn = document.getElementById('nextBtn');
  const progressFill = document.getElementById('progressFill');

  let current = 0;

  steps.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = 'dot' + (i === 0 ? ' active' : '');
    // Keyboard-operable step jump, not just a mouse target.
    dot.tabIndex = 0;
    dot.setAttribute('role', 'button');
    dot.setAttribute('aria-label', `${i + 1}/${steps.length}`);
    dot.addEventListener('click', () => goTo(i));
    dot.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      goTo(i);
    });
    dotsEl.appendChild(dot);
  });
  const dots = Array.from(dotsEl.children);

  function goTo(idx) {
    const dir = idx > current ? 'left' : 'right';
    steps[current].classList.remove('active');
    current = Math.max(0, Math.min(steps.length - 1, idx));
    const step = steps[current];
    step.classList.remove('anim-left', 'anim-right');
    void step.offsetWidth; // reflow
    step.classList.add('active', `anim-${dir}`);
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
    backBtn.disabled = current === 0;
    const isLast = current === steps.length - 1;
    const lang = document.documentElement.lang || 'en';
    nextBtn.textContent = isLast
      ? (lang === 'en' ? '✓ Done' : 'סיום ✓')
      : (lang === 'en' ? 'Next →' : 'הבא →');
    if (progressFill) {
      progressFill.style.width = ((current + 1) / steps.length * 100) + '%';
    }
  }

  backBtn.addEventListener('click', () => { if (current > 0) goTo(current - 1); });

  const skipBtn = document.getElementById('skipBtn');
  skipBtn && skipBtn.addEventListener('click', () => {
    window.tapactWelcome && window.tapactWelcome.skip();
  });

  nextBtn.addEventListener('click', () => {
    if (current < steps.length - 1) {
      goTo(current + 1);
    } else {
      window.tapactWelcome && window.tapactWelcome.finish();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.tapactWelcome && window.tapactWelcome.skip();
    if (e.key === 'ArrowLeft') { if (document.documentElement.dir === 'rtl') nextBtn.click(); else backBtn.click(); }
    if (e.key === 'ArrowRight') { if (document.documentElement.dir === 'rtl') backBtn.click(); else nextBtn.click(); }
  });

  goTo(0);
});
