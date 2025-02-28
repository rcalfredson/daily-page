function updateTagHeader() {
  const tagHeader = document.querySelector('.block-tags-header');
  const tagPills = document.querySelectorAll('#tag-container .tag-pill');
  if (tagHeader) {
    if (tagPills.length > 0) {
      tagHeader.textContent = "Tags:"; // Si hay tags, mostramos "Tags:"
    } else {
      tagHeader.textContent = "No tags yet! Add some:"; // Si no hay tags, mostramos el mensaje
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const tagContainer = document.getElementById('tag-container');
  if (!tagContainer) return;

  // Remove tag functionality
  tagContainer.addEventListener('click', function (e) {
    if (e.target && e.target.classList.contains('tag-remove')) {
      const tag = e.target.getAttribute('data-tag');
      // Remove the tag visually
      const pill = e.target.parentElement;
      pill.remove();
      updateTagHeader();
      // Update backend by removing the tag from the list
      updateTagsOnBackend();
    }
  });

  // Add new tag functionality
  const addTagBtn = document.getElementById('add-tag-btn');
  if (addTagBtn) {
    addTagBtn.addEventListener('click', () => {
      const newTagInput = document.getElementById('new-tag');
      const newTag = newTagInput.value.trim();
      if (newTag) {
        // Create a new pill element
        const newPill = document.createElement('span');
        newPill.classList.add('tag-pill');
        newPill.textContent = newTag;
        // Add remove button for pill if user can manage block
        const removeBtn = document.createElement('button');
        removeBtn.classList.add('tag-remove');
        removeBtn.setAttribute('data-tag', newTag);
        removeBtn.textContent = ' x';
        newPill.appendChild(removeBtn);
        // Insert the new pill before the add interface
        const tagAdd = document.querySelector('.tag-add');
        tagContainer.insertBefore(newPill, tagAdd);
        newTagInput.value = '';
        updateTagHeader();
        // Update backend with the new tag list
        updateTagsOnBackend();
      }
    });
  }

  // Function to collect all tags and update backend
  function updateTagsOnBackend() {
    // Collect current tags from all pills (removing any extra whitespace or the "x")
    const pills = tagContainer.querySelectorAll('.tag-pill');
    const tags = Array.from(pills).map(pill => {
      // Remove the 'x' if appended
      return pill.firstChild.textContent.trim();
    });
    // Call backend API to update tags
    fetch(`/api/v1/blocks/${block_id}/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: tags })
    })
      .then(response => {
        if (!response.ok) {
          alert('Error updating tags.');
        }
      })
      .catch(err => console.error('Failed to update tags:', err));
  }
});
