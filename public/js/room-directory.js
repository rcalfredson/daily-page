document.addEventListener('DOMContentLoaded', () => {
  if (typeof window.i18nT !== 'function') {
    console.warn('i18nT not available in room-directory.js');
  }

  const headers = document.querySelectorAll('.topic-header');
  const tiles = document.querySelectorAll('.room-tile');
  const modal = document.querySelector('.room-modal');
  const modalTitle = document.querySelector('.modal-title');
  const modalDescription = document.querySelector('.modal-description');
  const modalLink = document.querySelector('.modal-link');
  const modalActiveUsers = document.querySelector('.modal-active-users');
  const modalClose = document.querySelector('.modal-close');

  const isMobile = () => window.innerWidth <= 768;

  const getActiveUsersLabel = count => (
    typeof window.i18nT === 'function'
      ? i18nT('roomsDirectory.activeUsers', { count })
      : `Active users: ${count}`
  );

  const fetchActiveUsers = async roomId => {
    try {
      const response = await fetch(`/api/v1/rooms/active-users/${roomId}`);
      if (!response.ok) {
        throw new Error('fetch failed');
      }

      const data = await response.json();
      return data.activeUsers || 0;
    } catch {
      return 0;
    }
  };

  const updateBadge = (tile, activeUsers) => {
    const badge = tile.querySelector('.room-activity');
    if (!badge) {
      return;
    }

    badge.textContent = getActiveUsersLabel(activeUsers);
    badge.classList.add('is-visible');
    tile.dataset.roomActiveUsers = String(activeUsers);
    tile.dataset.roomActiveUsersLoaded = 'true';
  };

  const ensureActiveUsers = async tile => {
    if (tile.dataset.roomActiveUsersLoaded === 'true') {
      return Number(tile.dataset.roomActiveUsers || 0);
    }

    const roomId = tile.dataset.roomId;
    const activeUsers = await fetchActiveUsers(roomId);
    updateBadge(tile, activeUsers);
    return activeUsers;
  };

  const setExpandedState = (section, icon, expanded) => {
    if (expanded) {
      section.classList.remove('collapsed');
      icon.classList.remove('collapsed');
      section.style.maxHeight = `${section.scrollHeight}px`;
      return;
    }

    if (section.style.maxHeight === 'none') {
      section.style.maxHeight = `${section.scrollHeight}px`;
    }

    section.classList.add('collapsed');
    icon.classList.add('collapsed');

    requestAnimationFrame(() => {
      section.style.maxHeight = '0px';
    });
  };

  headers.forEach(header => {
    const topicSection = header.nextElementSibling;
    const icon = header.querySelector('.expand-icon');
    const isRecentlyActive = header.dataset.recentlyActive === 'true';

    setExpandedState(topicSection, icon, isRecentlyActive);

    topicSection.addEventListener('transitionend', event => {
      if (
        event.propertyName === 'max-height' &&
        !topicSection.classList.contains('collapsed')
      ) {
        topicSection.style.maxHeight = 'none';
      }
    });

    header.addEventListener('click', () => {
      const shouldExpand = topicSection.classList.contains('collapsed');
      setExpandedState(topicSection, icon, shouldExpand);
    });
  });

  window.addEventListener('resize', () => {
    document.querySelectorAll('.room-grid.collapsible').forEach(section => {
      if (!section.classList.contains('collapsed')) {
        section.style.maxHeight = 'none';
      }
    });
  });

  tiles.forEach(tile => {
    if (tile.dataset.roomActiveUsersLoaded === 'true') {
      updateBadge(tile, Number(tile.dataset.roomActiveUsers || 0));
    }

    tile.addEventListener('mouseenter', () => {
      if (!isMobile()) {
        void ensureActiveUsers(tile);
      }
    });

    tile.addEventListener('focusin', () => {
      if (!isMobile()) {
        void ensureActiveUsers(tile);
      }
    });

    tile.addEventListener('click', async event => {
      if (!isMobile()) {
        return;
      }

      event.preventDefault();

      const title = tile.dataset.roomTitle;
      const desc = tile.dataset.roomDescription;
      const href = tile.dataset.roomLink;
      const activeUsers = await ensureActiveUsers(tile);

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

      modalActiveUsers.textContent = getActiveUsersLabel(activeUsers);
      modalLink.href = href || '#';
      modal.classList.add('visible');
    });
  });

  if (modalClose) {
    modalClose.addEventListener('click', () => modal.classList.remove('visible'));
  }

  if (modal) {
    modal.addEventListener('click', event => {
      if (event.target === modal) {
        modal.classList.remove('visible');
      }
    });
  }
});
