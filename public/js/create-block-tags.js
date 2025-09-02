// public/js/create-block-tags.js
document.addEventListener('DOMContentLoaded', () => {
  const hiddenTagsInput = document.getElementById('hidden-tags');
  const tagContainer = document.getElementById('tag-container');
  if (!hiddenTagsInput || !tagContainer) return;

  const nsTags = I18n.get('blockTags', {});
  const tTags = (path, params) => I18n.t(nsTags, path, params);

  function updateHiddenTags() {
    const pills = tagContainer.querySelectorAll('.tag-pill');
    const tags = Array.from(pills).map(pill => pill.firstChild.textContent.trim());
    hiddenTagsInput.value = tags.join(',');
    updateTagHeader();
  }

  function updateTagHeader() {
    const tagHeader = document.querySelector('.block-tags-header');
    const pills = tagContainer.querySelectorAll('.tag-pill');
    if (tagHeader) {
      tagHeader.textContent = (pills.length > 0)
        ? tTags('header.withTags')     // "Tags:"
        : tTags('header.noTags');      // "No tags yet! Add some:"
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
      removeBtn.textContent = ' x';
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
