document.addEventListener('DOMContentLoaded', () => {
  const starButton = document.querySelector('.star-btn');
  if (!starButton) return;

  starButton.addEventListener('click', async () => {
    const isLoggedIn = document.body.dataset.isLoggedIn === "true";
    if (!isLoggedIn) {
      window.showLoginModal("star this room");
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

      const data = await res.json();

      starButton.classList.toggle('starred');
      const iconElem = starButton.querySelector('i');

      if (starButton.classList.contains('starred')) {
        iconElem.classList.remove('fa-star-o', 'far');
        iconElem.classList.add('fa-star', 'fas');
        starButton.title = "Unstar this room"; 
      } else {
        iconElem.classList.remove('fa-star', 'fas');
        iconElem.classList.add('fa-star-o', 'far');
        starButton.title = "Star this room"; 
      }

    } catch (err) {
      console.error('Error toggling star:', err);
      alert('Failed to update star status. Please try again.');
    }
  });
});
