document.addEventListener('DOMContentLoaded', () => {
  const editorialControls = document.querySelectorAll('.block-editorial-more');
  if (!editorialControls.length) return;

  for (const details of editorialControls) {
    const label = details.querySelector('.block-editorial-more__label');
    if (!label) continue;

    const expandLabel = details.dataset.expandLabel || 'Show more';
    const collapseLabel = details.dataset.collapseLabel || 'Show less';

    const syncLabel = () => {
      label.textContent = details.open ? collapseLabel : expandLabel;
    };

    syncLabel();
    details.addEventListener('toggle', syncLabel);
  }
});
