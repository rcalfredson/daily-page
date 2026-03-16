(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const root = document.querySelector('details.ui-lang-switcher');
    const menu = root?.querySelector('.ui-lang-menu');
    if (!root || !menu) return;

    function positionMenu() {
      menu.style.removeProperty('transform');
      menu.style.removeProperty('top');

      if (!root.open) return;

      if (window.innerWidth <= 979) {
        const rect = root.getBoundingClientRect();
        const top = Math.max(12, Math.round(rect.bottom + 10));
        menu.style.top = `${top}px`;
        return;
      }

      const margin = 12;
      const rect = menu.getBoundingClientRect();
      let shift = 0;

      if (rect.left < margin) {
        shift = margin - rect.left;
      } else if (rect.right > window.innerWidth - margin) {
        shift = (window.innerWidth - margin) - rect.right;
      }

      if (shift !== 0) {
        menu.style.transform = `translateX(${Math.round(shift)}px)`;
      }
    }

    root.addEventListener('toggle', function () {
      if (root.open) {
        positionMenu();
      }
    });

    window.addEventListener('resize', function () {
      if (root.open) {
        positionMenu();
      }
    });
  });
})();
