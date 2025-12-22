// public/js/star-room.js
document.addEventListener('DOMContentLoaded', () => {
  const starButton = document.querySelector('.star-btn');
  if (!starButton) return;

  const hasI18n = typeof window.i18nT === 'function';

  const getStarTitle = () => {
    if (!hasI18n) return 'Star this room';
    const key = 'roomDashboard.actions.starTitle';
    const maybe = i18nT(key);
    return (maybe && maybe !== key) ? maybe : 'Star this room';
  };

  const getUnstarTitle = () => {
    if (!hasI18n) return 'Unstar this room';
    const key = 'roomDashboard.actions.unstarTitle';
    const maybe = i18nT(key);
    return (maybe && maybe !== key) ? maybe : 'Unstar this room';
  };

  const getStarToggleError = () => {
    if (!hasI18n) return 'Error starring this room.';
    const key = 'modals.errors.starToggleFail';
    const maybe = i18nT(key);
    return (maybe && maybe !== key) ? maybe : 'Error starring this room.';
  };

  starButton.addEventListener('click', async () => {
    const isLoggedIn = document.body.dataset.isLoggedIn === 'true';
    if (!isLoggedIn) {
      // Este sigue igual: el login modal se encarga de su propio i18n
      window.showLoginModal('actions.starRoom');
      return;
    }

    const roomId = starButton.dataset.roomId;
    const isStarred = starButton.classList.contains('starred');
    const action = isStarred ? 'unstar' : 'star';

    try {
      const userId = document.body.dataset.userId;

      const res = await fetch(`/api/v1/users/${userId}/starredRooms`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, action })
      });

      if (!res.ok) throw new Error('Failed to star/unstar room');

      await res.json();

      starButton.classList.toggle('starred');
      const iconElem = starButton.querySelector('i');

      if (!iconElem) return;

      if (starButton.classList.contains('starred')) {
        iconElem.classList.remove('fa-star-o', 'far');
        iconElem.classList.add('fa-star', 'fas');

        const title = getUnstarTitle();
        starButton.title = title;
        starButton.setAttribute('aria-label', title);
      } else {
        iconElem.classList.remove('fa-star', 'fas');
        iconElem.classList.add('fa-star-o', 'far');

        const title = getStarTitle();
        starButton.title = title;
        starButton.setAttribute('aria-label', title);
      }

    } catch (err) {
      console.error('Error toggling star:', err);
      alert(getStarToggleError());
    }
  });
});
