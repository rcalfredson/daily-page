document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.dashboard-container');
  const editBioBtn = document.getElementById('edit-bio-btn');
  const bioText = document.querySelector('.bio-text');
  const bioInput = document.getElementById('bio-input');
  const saveBioBtn = document.getElementById('save-bio-btn');
  const cancelBioBtn = document.getElementById('cancel-bio-btn');
  const bioEditButtons = document.querySelector('.bio-edit-buttons');

  if (!container || !editBioBtn || !bioText || !bioInput || !saveBioBtn || !cancelBioBtn || !bioEditButtons) return;

  const userId = container.dataset.userId;
  const msgBioUpdateFailed = container.dataset.bioUpdateFailed || 'Error updating bio. Please try again.';
  const msgNoBio = container.dataset.noBio || 'No bio yet. Click "Edit" to add one!';

  editBioBtn.addEventListener('click', () => {
    bioInput.value = bioText.textContent.trim();
    bioText.classList.add('hidden');
    bioInput.classList.remove('hidden');
    bioEditButtons.classList.remove('hidden');
    editBioBtn.classList.add('hidden');
    bioInput.focus();
  });

  saveBioBtn.addEventListener('click', () => {
    const newBio = bioInput.value.trim();

    fetch(`/api/v1/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio: newBio })
    })
      .then(response => {
        if (!response.ok) throw new Error('Failed to update bio');
        return response.json();
      })
      .then(() => {
        bioText.textContent = newBio || msgNoBio;
        exitEditMode();
      })
      .catch(err => {
        console.error('Error updating bio:', err);
        alert(msgBioUpdateFailed);
      });
  });

  cancelBioBtn.addEventListener('click', exitEditMode);

  function exitEditMode() {
    bioInput.classList.add('hidden');
    bioEditButtons.classList.add('hidden');
    bioText.classList.remove('hidden');
    editBioBtn.classList.remove('hidden');
  }
});
