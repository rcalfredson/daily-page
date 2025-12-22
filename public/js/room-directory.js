// public/js/room-directory.js
document.addEventListener('DOMContentLoaded', () => {
  if (typeof window.i18nT !== 'function') {
    console.warn('i18nT not available in room-directory.js');
  }

  const headers = document.querySelectorAll('.topic-header');
  const modal = document.querySelector('.room-modal');
  const modalTitle = document.querySelector('.modal-title');
  const modalDescription = document.querySelector('.modal-description');
  const modalLink = document.querySelector('.modal-link');
  const modalActiveUsers = document.querySelector('.modal-active-users');
  const modalClose = document.querySelector('.modal-close');

  const isMobile = () => window.innerWidth <= 768;

  // Fetch active users for a room
  const fetchActiveUsers = async (roomId) => {
    try {
      const response = await fetch(`/api/v1/rooms/active-users/${roomId}`);
      if (!response.ok) throw new Error('fetch failed');
      const data = await response.json();
      return data.activeUsers || 0;
    } catch {
      return 0;
    }
  };

  // Collapsible behavior
  headers.forEach(header => {
    const topicSection = header.nextElementSibling;
    const icon = header.querySelector('.expand-icon');
    const isRecentlyActive = header.dataset.recentlyActive === 'true';

    if (!isRecentlyActive) {
      topicSection.classList.add('collapsed');
      topicSection.style.maxHeight = 0;
      icon.classList.add('collapsed');
    } else {
      topicSection.style.maxHeight = topicSection.scrollHeight + 'px';
    }

    header.addEventListener('click', () => {
      if (topicSection.classList.contains('collapsed')) {
        topicSection.classList.remove('collapsed');
        icon.classList.remove('collapsed');
        topicSection.style.maxHeight = topicSection.scrollHeight + 'px';
      } else {
        topicSection.style.maxHeight = 0;
        topicSection.classList.add('collapsed');
        icon.classList.add('collapsed');
      }
    });
  });

  // Dynamic hover: active users
  document.querySelectorAll('.room-tile').forEach(tile => {
    const badge = tile.querySelector('.room-activity');
    if (badge) badge.style.display = 'none';

    tile.addEventListener('mouseenter', async () => {
      if (!isMobile()) {
        const roomId = tile.getAttribute('data-room-link').split('/').pop();
        const activeUsers = await fetchActiveUsers(roomId);

        if (badge) {
          const msg = (typeof window.i18nT === 'function')
            ? i18nT('roomsDirectory.activeUsers', { count: activeUsers })
            : `Active users: ${activeUsers}`;

          badge.textContent = msg;
          badge.style.opacity = 1;
          badge.style.display = 'unset';
        }
      }
    });

    tile.addEventListener('mouseleave', () => {
      if (badge) {
        badge.style.opacity = 0;
        badge.style.display = 'none';
      }
    });

    // Mobile modal
    tile.addEventListener('click', async (e) => {
      if (isMobile()) {
        e.preventDefault();

        const title = tile.getAttribute('data-room-title');
        const desc = tile.getAttribute('data-room-description');
        const href = tile.getAttribute('data-room-link');
        const roomId = href.split('/').pop();
        const activeUsers = await fetchActiveUsers(roomId);

        modalTitle.textContent =
          title ||
          (typeof window.i18nT === 'function'
            ? i18nT('roomsDirectory.noTitle')
            : 'No title');

        modalDescription.textContent =
          desc ||
          (typeof window.i18nT === 'function'
            ? i18nT('roomsDirectory.noDescription')
            : 'No description');

        modalActiveUsers.textContent =
          (typeof window.i18nT === 'function')
            ? i18nT('roomsDirectory.activeUsers', { count: activeUsers })
            : `Active users: ${activeUsers}`;

        modalLink.href = href || '#';
        modal.classList.add('visible');
      }
    });
  });

  // Close modal
  modalClose.addEventListener('click', () => modal.classList.remove('visible'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('visible');
  });
});
