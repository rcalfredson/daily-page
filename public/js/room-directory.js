document.addEventListener('DOMContentLoaded', () => {
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
      if (!response.ok) throw new Error('Failed to fetch active users.');
      const data = await response.json();
      return data.activeUsers || 0;
    } catch (error) {
      console.error(`Error fetching active users for room ${roomId}:`, error.message);
      return 0;
    }
  };

  // Collapsible section behavior
  headers.forEach(header => {
    const topicSection = header.nextElementSibling;
    const icon = header.querySelector('.expand-icon');
    if (header.dataset.topic !== 'Recently Active') {
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

  // Dynamic hover behavior for non-recently-active tiles
  document.querySelectorAll('.room-tile').forEach(tile => {
    const activeUsersBadge = tile.querySelector('.room-activity');
    activeUsersBadge.style.display = 'none';

    tile.addEventListener('mouseenter', async () => {
      if (!isMobile() && !tile.classList.contains('recently-active')) {
        const roomId = tile.getAttribute('data-room-link').split('/').pop();
        const activeUsers = await fetchActiveUsers(roomId);
        activeUsersBadge.textContent = `Active Users: ${activeUsers}`;
        activeUsersBadge.style.opacity = 1;
        activeUsersBadge.style.display = 'unset';
      }
    });

    tile.addEventListener('mouseleave', () => {
      if (!tile.classList.contains('recently-active')) {
        activeUsersBadge.style.opacity = 0;
        activeUsersBadge.style.display = 'none';
      }
    });

    // Modal behavior for mobile
    tile.addEventListener('click', async (e) => {
      if (isMobile()) {
        e.preventDefault(); // Prevent link navigation on mobile
        const title = tile.getAttribute('data-room-title');
        const description = tile.getAttribute('data-room-description');
        const href = tile.getAttribute('data-room-link');
        const roomId = href.split('/').pop();
        const activeUsers = await fetchActiveUsers(roomId);

        const activeUsersText = `Active Users: ${activeUsers}`;

        modalTitle.textContent = title || 'No Title Available';
        modalDescription.textContent = description || 'No Description Available';
        modalActiveUsers.textContent = activeUsersText;
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
