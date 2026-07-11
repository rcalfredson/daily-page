(() => {
  const discovery = document.querySelector('[data-home-discovery]');
  if (!discovery) return;

  const tabs = [...discovery.querySelectorAll('[data-home-tab]')];
  const panels = [...discovery.querySelectorAll('[data-home-panel]')];
  let activeIndex = 0;

  function selectTab(index, { focus = false } = {}) {
    activeIndex = (index + tabs.length) % tabs.length;
    tabs.forEach((tab, tabIndex) => {
      const selected = tabIndex === activeIndex;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    panels.forEach((panel, panelIndex) => {
      panel.classList.toggle('is-active', panelIndex === activeIndex);
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(index));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Home') return selectTab(0, { focus: true });
      if (event.key === 'End') return selectTab(tabs.length - 1, { focus: true });
      selectTab(activeIndex + (event.key === 'ArrowRight' ? 1 : -1), { focus: true });
    });
  });

  let touchStart = null;
  discovery.addEventListener('touchstart', (event) => {
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  discovery.addEventListener('touchend', (event) => {
    if (!touchStart || !window.matchMedia('(max-width: 799px)').matches) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    selectTab(activeIndex + (deltaX < 0 ? 1 : -1));
  }, { passive: true });
})();
