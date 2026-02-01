// public/js/details-autoclose.js
(function () {
  const selector = 'details.ui-lang-switcher, details.block-lang-switcher';

  function closeAll(except = null) {
    document.querySelectorAll(selector).forEach(d => {
      if (d !== except) d.removeAttribute('open');
    });
  }

  // Close when clicking/tapping outside
  function onPointerDown(e) {
    const openDetails = Array.from(document.querySelectorAll(selector))
      .filter(d => d.hasAttribute('open'));

    if (!openDetails.length) return;

    // If the click is inside ANY open details, do nothing
    const clickedInside = openDetails.some(d => d.contains(e.target));
    if (!clickedInside) closeAll();
  }

  // Close on Escape
  function onKeyDown(e) {
    if (e.key === 'Escape') closeAll();
  }

  // When one opens, close the others
  function onToggle(e) {
    const d = e.target;
    if (d.matches(selector) && d.open) closeAll(d);
  }

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('toggle', onToggle, true);
})();
