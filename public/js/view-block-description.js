document.addEventListener('DOMContentLoaded', () => {
  const descCard = document.querySelector('.block-description-card');
  if (!descCard) return;

  const descBody = descCard.querySelector('.description-body');
  const viewParagraph = descBody.querySelector('#description-view');
  const expandToggleContainer = descCard.querySelector('.expand-toggle');
  const expandToggle = expandToggleContainer?.querySelector('span');

  if (!viewParagraph || !expandToggle) return;

  // Check if the description text is tall enough to need collapse/expand
  function updateToggleAvailability() {
    // If paragraph is <= 150px in height, hide toggle and keep fully expanded
    if (viewParagraph.scrollHeight <= 150) {
      expandToggleContainer.style.display = 'none';
      descBody.classList.remove('collapsed');
    } else {
      // If taller than 150px, show toggle and default to collapsed
      expandToggleContainer.style.display = 'block';
      descBody.classList.add('collapsed');
      expandToggle.textContent = 'Expand';
    }
  }

  // Initialize
  updateToggleAvailability();

  // Expand/Collapse on click
  expandToggle.addEventListener('click', () => {
    const isCollapsed = descBody.classList.contains('collapsed');
    descBody.classList.toggle('collapsed', !isCollapsed);
    expandToggle.textContent = isCollapsed ? 'Collapse' : 'Expand';
  });
});
