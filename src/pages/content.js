/*!
 * Content Engine Tab Logic — Vivid Pulse
 */
import '/src/style.css';

document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  if (!tabs.length) return;

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      // Update button styles
      tabs.forEach(t => {
        t.classList.remove('active-yt', 'active-ig');
      });

      if (target === 'youtube') btn.classList.add('active-yt');
      if (target === 'instagram') btn.classList.add('active-ig');

      // Switch panels
      panels.forEach(p => p.classList.remove('active'));
      const targetPanel = document.getElementById('tab-' + target);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });
});
