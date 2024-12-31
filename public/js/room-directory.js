document.addEventListener('DOMContentLoaded', () => {
  const headers = document.querySelectorAll('.topic-header');
  const modal = document.querySelector('.room-modal');
  const modalTitle = document.querySelector('.modal-title');
  const modalDescription = document.querySelector('.modal-description');
  const modalLink = document.querySelector('.modal-link');
  const modalClose = document.querySelector('.modal-close');

  const isMobile = () => window.innerWidth <= 768;

  // Collapsible section behavior
  headers.forEach(header => {
    const topicSection = header.nextElementSibling;
    const icon = header.querySelector('.expand-icon');
    topicSection.classList.add('collapsed');
    topicSection.style.maxHeight = 0;
    icon.classList.add('collapsed');

    header.addEventListener('click', () => {
      if (topicSection.classList.contains('collapsed')) {
        topicSection.classList.remove('collapsed');
        icon.classList.remove('collapsed');
        topicSection.style.maxHeight = topicSection.scrollHeight + 'px';
      } else {
        topicSection.classList.add('collapsed');
        icon.classList.add('collapsed');
        topicSection.style.maxHeight = 0;
      }
    });
  });

  // Modal behavior
  document.querySelectorAll('.room-tile').forEach(tile => {
    const link = tile.querySelector('.room-link');

    tile.addEventListener('click', (e) => {
      if (isMobile()) {
        e.preventDefault(); // Prevent link navigation on mobile
        const title = tile.getAttribute('data-room-title');
        const description = tile.getAttribute('data-room-description');
        const href = tile.getAttribute('data-room-link');

        modalTitle.textContent = title || 'No Title Available';
        modalDescription.textContent = description || 'No Description Available';
        modalLink.href = href || '#';

        modal.classList.add('visible');
      }
    });
  });

  // Close modal
  modalClose.addEventListener('click', () => {
    modal.classList.remove('visible');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('visible');
    }
  });
});
