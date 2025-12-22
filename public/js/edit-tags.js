// public/js/edit-tags.js
document.addEventListener('DOMContentLoaded', () => {
  const tagContainer = document.getElementById('tag-container');
  if (!tagContainer) return;

  // Local helper: prefer global i18nT, but don't break if missing
  const t =
    typeof window.i18nT === 'function'
      ? window.i18nT
      : key => key;

  function updateTagHeader() {
    const tagHeader = document.querySelector('.block-tags-header');
    const tagPills = document.querySelectorAll('#tag-container .tag-pill');
    if (!tagHeader) return;

    tagHeader.textContent =
      tagPills.length > 0
        ? t('blockTags.header.withTags')
        : t('blockTags.header.noTags');
  }

  // Remove tag functionality
  tagContainer.addEventListener('click', function (e) {
    if (e.target && e.target.classList.contains('tag-remove')) {
      const pill = e.target.parentElement;
      pill.remove();
      updateTagHeader();
      updateTagsOnBackend();
    }
  });

  // Add new tag functionality
  const addTagBtn = document.getElementById('add-tag-btn');
  if (addTagBtn) {
    addTagBtn.addEventListener('click', () => {
      const newTagInput = document.getElementById('new-tag');
      const newTag = newTagInput.value.trim();
      if (!newTag) return;

      // Create a new pill element
      const newPill = document.createElement('span');
      newPill.classList.add('tag-pill');
      newPill.textContent = newTag;

      // Add remove button for pill if user can manage block
      const removeBtn = document.createElement('button');
      removeBtn.classList.add('tag-remove');
      removeBtn.setAttribute('data-tag', newTag);

      // Keep existing behavior (leading space) to avoid any CSS/layout surprises
      removeBtn.textContent = ' ' + t('blockTags.buttons.removeTag');

      newPill.appendChild(removeBtn);

      // Insert the new pill before the add interface
      const tagAdd = document.querySelector('.tag-add');
      if (tagAdd) {
        tagContainer.insertBefore(newPill, tagAdd);
      } else {
        tagContainer.appendChild(newPill);
      }

      newTagInput.value = '';
      updateTagHeader();
      updateTagsOnBackend();
    });
  }

  // Function to collect all tags and update backend
  function updateTagsOnBackend() {
    // Collect current tags from all pills
    const pills = tagContainer.querySelectorAll('.tag-pill');
    const tags = Array.from(pills).map(pill =>
      pill.firstChild.textContent.trim()
    );

    fetch(`/api/v1/blocks/${block_id}/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags })
    })
      .then(response => {
        if (!response.ok) {
          // Reuse existing editor key so we don't introduce new config
          alert(t('blockEditor.tags.updateError'));
        }
      })
      .catch(err => console.error('Failed to update tags:', err));
  }

  // Init header once on load
  updateTagHeader();
});
