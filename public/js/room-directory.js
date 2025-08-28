document.addEventListener('DOMContentLoaded', () => {
  // ---- i18n bootstrap ------------------------------------------------------
  const parseJSON = (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent || '{}'); } catch { return null; }
  };
  const I18N_NS = parseJSON('i18n-roomsDirectory') || {};
  const CURRENT_LANG = parseJSON('i18n-lang') || 'en';

  const deepGet = (obj, dotted) =>
    dotted.split('.').reduce((o, k) => (o && k in o) ? o[k] : undefined, obj);

  const interpolate = (str, params = {}) =>
    String(str).replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`));

  // Acepta 'roomsDirectory.key' o 'key' (azúcar)
  const t = (key, params) => {
    const path = key.startsWith('roomsDirectory.') ? key.slice('roomsDirectory.'.length) : key;
    const val = deepGet(I18N_NS, path);
    return (val == null) ? key : interpolate(val, params);
  };
  // --------------------------------------------------------------------------

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

  // Collapsible behavior (sin depender del label traducido)
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

  // Dynamic hover (usa t('activeUsers'))
  document.querySelectorAll('.room-tile').forEach(tile => {
    const activeUsersBadge = tile.querySelector('.room-activity');
    if (activeUsersBadge) activeUsersBadge.style.display = 'none';

    tile.addEventListener('mouseenter', async () => {
      if (!isMobile()) {
        const roomId = tile.getAttribute('data-room-link').split('/').pop();
        const activeUsers = await fetchActiveUsers(roomId);
        if (activeUsersBadge) {
          activeUsersBadge.textContent = t('roomsDirectory.activeUsers', { count: activeUsers });
          activeUsersBadge.style.opacity = 1;
          activeUsersBadge.style.display = 'unset';
        }
      }
    });

    tile.addEventListener('mouseleave', () => {
      if (activeUsersBadge) {
        activeUsersBadge.style.opacity = 0;
        activeUsersBadge.style.display = 'none';
      }
    });

    // Modal (usa fallbacks traducidos)
    tile.addEventListener('click', async (e) => {
      if (isMobile()) {
        e.preventDefault();
        const title = tile.getAttribute('data-room-title');
        const description = tile.getAttribute('data-room-description');
        const href = tile.getAttribute('data-room-link');
        const roomId = href.split('/').pop();
        const activeUsers = await fetchActiveUsers(roomId);

        modalTitle.textContent = title || t('roomsDirectory.noTitle');
        modalDescription.textContent = description || t('roomsDirectory.noDescription');
        modalActiveUsers.textContent = t('roomsDirectory.activeUsers', { count: activeUsers });
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
