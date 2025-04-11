document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab-links li');
  const panes = document.querySelectorAll('.tab-pane');

  function adjustPreviewHeight(pane) {
    pane.querySelectorAll('.content-preview').forEach(el => {
      const hasEarlyImage = el.querySelector('img')?.offsetTop < 50; // Detecta imágenes cerca del inicio
      el.classList.toggle('tall-preview', hasEarlyImage);
    });
  }

  function updateFadeEffect(pane) {
    pane.querySelectorAll('.content-preview').forEach(el => {
      const lineHeightPx = getComputedStyle(el).lineHeight;
      let lineHeight = parseFloat(lineHeightPx);

      // Si aún es NaN (por ejemplo, "normal"), usa fallback de 20px
      if (isNaN(lineHeight)) lineHeight = 20;
      const height = el.scrollHeight;

      if (height <= lineHeight * 1.5 || height === 0) {
        el.classList.add('no-fade');
      } else {
        el.classList.remove('no-fade');
      }

      adjustPreviewHeight(pane);
    });
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const activePane = document.getElementById(tab.getAttribute('data-tab'));
      activePane.classList.add('active');

      // ✅ Now, check content-preview height each time a pane activates
      updateFadeEffect(activePane);
    });
  });

  // ✅ Initial run for default active pane
  const initialActivePane = document.querySelector('.tab-pane.active');
  if (initialActivePane) updateFadeEffect(initialActivePane);
});
