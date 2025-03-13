document.addEventListener('DOMContentLoaded', () => {
  const editBioBtn = document.getElementById('edit-bio-btn');
  const bioText = document.querySelector('.bio-text');
  const bioInput = document.getElementById('bio-input');
  const saveBioBtn = document.getElementById('save-bio-btn');
  const cancelBioBtn = document.getElementById('cancel-bio-btn');
  const bioEditButtons = document.querySelector('.bio-edit-buttons');
  const userId = document.querySelector('.dashboard-container').dataset.userId;

  // When clicking the "Edit Bio" button, switch to edit mode
  editBioBtn.addEventListener('click', () => {
    bioInput.value = bioText.textContent.trim();
    bioText.classList.add('hidden');
    bioInput.classList.remove('hidden');
    bioEditButtons.classList.remove('hidden');
    editBioBtn.classList.add('hidden');
    bioInput.focus();
  });

  // Save changes
  saveBioBtn.addEventListener('click', () => {
    const newBio = bioInput.value.trim();
    // Usa la ruta PUT
    fetch(`/api/v1/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio: newBio })
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to update bio');
        }
        return response.json();
      })
      .then(data => {
        bioText.textContent = newBio || 'No bio yet. Click "Edit" to add one!';
        exitEditMode();
      })
      .catch(err => {
        console.error('Error updating bio:', err);
        alert('Error updating bio. Please try again.');
      });
  });

  // Cancel editing
  cancelBioBtn.addEventListener('click', () => {
    exitEditMode();
  });

  function exitEditMode() {
    bioInput.classList.add('hidden');
    bioEditButtons.classList.add('hidden');
    bioText.classList.remove('hidden');
    editBioBtn.classList.remove('hidden');
  }
});
