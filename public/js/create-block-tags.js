// public/js/create-block-tags.js
document.addEventListener('DOMContentLoaded', () => {
  const hiddenTagsInput = document.getElementById('hidden-tags');
  const tagContainer = document.getElementById('tag-container');
  if (!hiddenTagsInput || !tagContainer) return;

  // Local helper: use i18nT if available, otherwise fall back gracefully
  const t = (typeof window.i18nT === 'function')
    ? window.i18nT
    : (k) => {
      // fallback simple
      if (k === 'blockTags.buttons.removeTag') return 'x';
      return k;
    };

  function updateHiddenTags() {
    const pills = tagContainer.querySelectorAll('.tag-pill');
    const tags = Array.from(pills).map(pill =>
      pill.firstChild.textContent.trim()
    );
    hiddenTagsInput.value = tags.join(',');
    updateTagHeader();
  }

  function updateTagHeader() {
    const tagHeader = document.querySelector('.block-tags-header');
    const pills = tagContainer.querySelectorAll('.tag-pill');
    if (tagHeader) {
      tagHeader.textContent =
        pills.length > 0
          ? t('blockTags.header.withTags')   // "Tags:"
          : t('blockTags.header.noTags');    // "No tags yet! Add some:"
    }
  }

  tagContainer.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('tag-remove')) {
      e.preventDefault();
      const pill = e.target.parentElement;
      pill.remove();
      updateHiddenTags();
    }
  });

  const addTagBtn = document.getElementById('add-tag-btn');
  if (addTagBtn) {
    addTagBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const newTagInput = document.getElementById('new-tag');
      const newTag = newTagInput.value.trim();
      if (!newTag) return;

      const newPill = document.createElement('span');
      newPill.classList.add('tag-pill');
      newPill.textContent = newTag;

      const removeBtn = document.createElement('button');
      removeBtn.classList.add('tag-remove');
      removeBtn.setAttribute('data-tag', newTag);
      // Leading space preserved as before
      removeBtn.textContent = ' ' + t('blockTags.buttons.removeTag');
      newPill.appendChild(removeBtn);

      const tagAdd = document.querySelector('.tag-add');
      if (tagAdd) {
        tagContainer.insertBefore(newPill, tagAdd);
      } else {
        tagContainer.appendChild(newPill);
      }

      newTagInput.value = '';
      updateHiddenTags();
    });
  }

  // inits
  updateTagHeader();
});
