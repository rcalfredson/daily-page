// public/js/set-share-link.js
document.addEventListener('DOMContentLoaded', () => {
  const linkInput = document.getElementById('myLinkInput');
  if (!linkInput) return;

  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  linkInput.textContent = url.toString();
});

// Wrap tooltip implementation so only toggleTooltip is global
(() => {
  let activeTooltip = null;
  let activeAnchor = null;

  function hideTooltip(tooltip) {
    tooltip.classList.add('hidden');
  }

  function positionTooltip(anchor, tooltip) {
    tooltip.style.position = 'absolute';
    tooltip.style.zIndex = '999999';

    const anchorRect = anchor.getBoundingClientRect();

    const wasHidden = tooltip.classList.contains('hidden');
    if (wasHidden) tooltip.classList.remove('hidden');

    const tooltipRect = tooltip.getBoundingClientRect();
    const offset = 6;

    let top = anchorRect.bottom + window.scrollY + offset;
    let left = anchorRect.left + window.scrollX + (anchorRect.width / 2) - (tooltipRect.width / 2);

    if (left + tooltipRect.width > window.innerWidth - 10) left = window.innerWidth - tooltipRect.width - 10;
    if (left < 10) left = 10;

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;

    if (wasHidden) tooltip.classList.add('hidden');
  }

  function cleanupTooltipListeners() {
    // capture must match: use boolean true to be unambiguous
    document.removeEventListener('click', onClickOutside, true);
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('resize', onResizeOrScroll);
    window.removeEventListener('scroll', onResizeOrScroll);

    activeTooltip = null;
    activeAnchor = null;
  }

  function onClickOutside(e) {
    if (!activeTooltip || !activeAnchor) return;

    if (!activeTooltip.contains(e.target) && !activeAnchor.contains(e.target)) {
      hideTooltip(activeTooltip);
      cleanupTooltipListeners();
    }
  }

  function onKeyDown(e) {
    if (e.key !== 'Escape') return;
    if (activeTooltip) hideTooltip(activeTooltip);
    cleanupTooltipListeners();
  }

  function onResizeOrScroll() {
    if (activeTooltip && activeAnchor && !activeTooltip.classList.contains('hidden')) {
      positionTooltip(activeAnchor, activeTooltip);
    }
  }

  // Export only what the template needs
  window.toggleTooltip = function toggleTooltip(event, tooltipId) {
    event.stopPropagation();

    const tooltip =
      document.getElementById(`${tooltipId}-tooltip`) ||
      document.getElementById(tooltipId);

    if (!tooltip) return;

    if (activeTooltip === tooltip && !activeTooltip.classList.contains('hidden')) {
      hideTooltip(activeTooltip);
      cleanupTooltipListeners();
      return;
    }

    if (activeTooltip && activeTooltip !== tooltip) {
      hideTooltip(activeTooltip);
    }

    activeTooltip = tooltip;
    activeAnchor = event.currentTarget;

    tooltip.classList.remove('hidden');
    positionTooltip(activeAnchor, tooltip);

    setTimeout(() => {
      // capture add must match capture remove: boolean true
      document.addEventListener('click', onClickOutside, true);
      document.addEventListener('keydown', onKeyDown);
      window.addEventListener('resize', onResizeOrScroll, { passive: true });
      window.addEventListener('scroll', onResizeOrScroll, { passive: true });
    });
  };
})();
