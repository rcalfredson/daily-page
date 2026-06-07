document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab-links li');
  const panes = document.querySelectorAll('.tab-pane');

  const activateTab = (tab) => {
    tabs.forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
      t.setAttribute('tabindex', '-1');
    });
    panes.forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    tab.setAttribute('tabindex', '0');
    const activePane = document.getElementById(tab.getAttribute('data-tab'));
    activePane.classList.add('active');
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', (event) => {
      const currentIndex = Array.from(tabs).indexOf(tab);
      const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;

      if (!direction) return;
      event.preventDefault();
      const nextTab = tabs[(currentIndex + direction + tabs.length) % tabs.length];
      activateTab(nextTab);
      nextTab.focus();
    });
  });

  // ✅ Initial run for default active pane

  const tabsContainer = document.querySelector('.tabs');
  const scrollElement = tabsContainer.querySelector('.tab-links');

  const updateFades = () => {
    const scrollLeft = scrollElement.scrollLeft;
    const maxScrollLeft = Math.max(0, scrollElement.scrollWidth - scrollElement.clientWidth);
    const isScrollable = maxScrollLeft > 2;

    tabsContainer.classList.toggle('fade-left', isScrollable && scrollLeft > 2);
    tabsContainer.classList.toggle('fade-right', isScrollable && scrollLeft < maxScrollLeft - 2);
  };

  updateFades();
  scrollElement.addEventListener('scroll', updateFades);
  window.addEventListener('resize', updateFades);
});
