document.addEventListener('DOMContentLoaded', () => {
  const profilePicInput = document.getElementById('profilePicInput');
  const profilePicImage = document.querySelector('.profile-pic');
  const userId = document.querySelector('.container').dataset.userId;

  profilePicInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('profilePic', file);

    try {
      const response = await fetch(`/api/v1/users/${userId}/uploadProfilePic`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error uploading profile picture:', errorData.error);
        alert('Failed to upload profile picture. Please try again.');
        return;
      }

      const { imageUrl } = await response.json();
      profilePicImage.src = imageUrl; // Update the profile picture dynamically
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      alert('An unexpected error occurred. Please try again.');
    }
  });
});
