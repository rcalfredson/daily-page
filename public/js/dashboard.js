document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.dashboard-container');
  const profileSection = document.querySelector('.profile-section');
  const profilePicInput = document.getElementById('profilePicInput');
  const profilePicImage = document.querySelector('.profile-pic');

  if (!container || !profileSection || !profilePicInput || !profilePicImage) return;

  const userId = container.dataset.userId;

  const msgUploadFailed = container.dataset.uploadFailed || 'Failed to upload profile picture. Please try again.';
  const msgUploadUnexpected = container.dataset.uploadUnexpected || 'An unexpected error occurred. Please try again.';

  const isTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouchScreen) profileSection.classList.add('touchscreen');

  profilePicInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('profilePic', file);

    try {
      const response = await fetch(`/api/v1/users/${userId}/uploadProfilePic`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        // Keep dev signal, but show localized user message
        let errorData = null;
        try { errorData = await response.json(); } catch (_) {}
        console.error('Error uploading profile picture:', errorData?.error || response.status);
        alert(msgUploadFailed);
        return;
      }

      const { imageUrl } = await response.json();
      if (imageUrl) profilePicImage.src = imageUrl;
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      alert(msgUploadUnexpected);
    }
  });
});
