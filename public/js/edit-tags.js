// public/js/edit-tags.js
document.addEventListener('DOMContentLoaded', () => {
  const tagContainer = document.getElementById('tag-container');
  if (!tagContainer) return;

  const t =
    typeof window.i18nT === 'function'
      ? window.i18nT
      : (key) => key;

  function toastError(key, fallback) {
    const msg = t(key);
    const finalMsg = (msg && msg !== key) ? msg : (fallback || key);
    if (typeof window.showToast === 'function') window.showToast(finalMsg, 'error');
    else alert(finalMsg);
  }

  function safeLabel(key, fallback) {
    const msg = t(key);
    return (msg && msg !== key) ? msg : fallback;
  }

  const addTagBtn = document.getElementById('add-tag-btn');
  const canManageTags = !!addTagBtn; // simple, matches your templates in practice

  function updateTagHeader() {
    const tagHeader = document.querySelector('.block-tags-header');
    const tagPills = document.querySelectorAll('#tag-container .tag-pill');
    if (!tagHeader) return;

    tagHeader.textContent =
      tagPills.length > 0
        ? safeLabel('blockTags.header.withTags', 'Tags')
        : safeLabel('blockTags.header.noTags', 'No tags');
  }

  tagContainer.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('tag-remove')) {
      const pill = e.target.parentElement;
      pill?.remove();
      updateTagHeader();
      updateTagsOnBackend();
    }
  });

  if (addTagBtn) {
    addTagBtn.addEventListener('click', () => {
      const newTagInput = document.getElementById('new-tag');
      const newTag = newTagInput?.value.trim();
      if (!newTag) return;

      const newPill = document.createElement('span');
      newPill.classList.add('tag-pill');
      newPill.textContent = newTag;

      // Only add remove button when manager UI exists
      if (canManageTags) {
        const removeBtn = document.createElement('button');
        removeBtn.classList.add('tag-remove');
        removeBtn.setAttribute('data-tag', newTag);

        // preserve leading space behavior
        const rm = safeLabel('blockTags.buttons.removeTag', 'x');
        removeBtn.textContent = ' ' + rm;

        newPill.appendChild(removeBtn);
      }

      const tagAdd = document.querySelector('.tag-add');
      if (tagAdd) tagContainer.insertBefore(newPill, tagAdd);
      else tagContainer.appendChild(newPill);

      newTagInput.value = '';
      updateTagHeader();
      updateTagsOnBackend();
    });
  }

  function updateTagsOnBackend() {
    if (typeof block_id === 'undefined') {
      console.warn('block_id not defined; tag updates will fail.');
      toastError('blockEditor.tags.updateError', 'Failed to update tags.');
      return;
    }

    const pills = tagContainer.querySelectorAll('.tag-pill');
    const tags = Array.from(pills).map((pill) => pill.firstChild.textContent.trim());

    fetch(`/api/v1/blocks/${block_id}/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags })
    })
      .then((response) => {
        if (!response.ok) {
          toastError('blockEditor.tags.updateError', 'Failed to update tags.');
        }
      })
      .catch((err) => {
        console.error('Failed to update tags:', err);
        toastError('blockEditor.tags.updateError', 'Failed to update tags.');
      });
  }

  updateTagHeader();
});
