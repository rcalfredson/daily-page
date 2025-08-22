document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab-links li');
  const panes = document.querySelectorAll('.tab-pane');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const activePane = document.getElementById(tab.getAttribute('data-tab'));
      activePane.classList.add('active');
    });
  });

  // ✅ Initial run for default active pane

  const tabsContainer = document.querySelector('.tabs');
  const scrollElement = tabsContainer.querySelector('.tab-links');

  const updateFades = () => {
    const scrollLeft = scrollElement.scrollLeft;
    const maxScrollLeft = scrollElement.scrollWidth - scrollElement.clientWidth;

    tabsContainer.classList.toggle('fade-left', scrollLeft > 2);
    tabsContainer.classList.toggle('fade-right', scrollLeft < maxScrollLeft - 2);
  };

  if (scrollElement.scrollWidth > scrollElement.clientWidth) {
    updateFades();
    scrollElement.addEventListener('scroll', updateFades);
    window.addEventListener('resize', updateFades); // handle resizes too
  }
});
