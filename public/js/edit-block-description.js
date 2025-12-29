document.addEventListener('DOMContentLoaded', () => {
  const md = window.markdownit?.();

  const t =
    typeof window.i18nT === 'function'
      ? window.i18nT
      : (key) => key;

  const descCard = document.querySelector('.block-description-card');
  if (!descCard) return;

  const descBody = descCard.querySelector('.description-body');
  const viewParagraph = descCard.querySelector('#description-view');
  const expandToggle = descCard.querySelector('.expand-toggle span');

  // Read-only essentials must exist
  if (!descBody || !viewParagraph || !expandToggle) return;

  // Edit-only elements (may be missing)
  const editBtn = descCard.querySelector('#edit-description-btn');
  const editTextarea = descCard.querySelector('#description-edit');
  const editButtons = descCard.querySelector('.edit-buttons');
  const saveBtn = descCard.querySelector('#save-description-btn');
  const cancelBtn = descCard.querySelector('#cancel-description-btn');

  const canEditDescription = !!(editBtn && editTextarea && editButtons && saveBtn && cancelBtn);

  const emptyKey = canEditDescription
    ? 'blockEditor.description.noDescriptionOwner'
    : 'blockEditor.description.noDescriptionViewer';

  function toastError(key, fallback) {
    const msg = t(key);
    const finalMsg = (msg && msg !== key) ? msg : (fallback || key);
    if (typeof window.showToast === 'function') window.showToast(finalMsg, 'error');
    else alert(finalMsg);
  }

  let isCollapsed = true;
  let isEditing = false;
  let originalDesc = canEditDescription ? (editTextarea.value || '') : '';

  function updateToggleAvailability() {
    // If your CSS collapses by max-height, consider using scrollHeight on the body instead.
    const needsToggle = viewParagraph.scrollHeight > 150;

    expandToggle.parentElement.style.display = needsToggle ? 'block' : 'none';

    if (!needsToggle) {
      isCollapsed = false;
      descBody.classList.remove('collapsed');
      return;
    }

    if (!isEditing) {
      isCollapsed = true;
      descBody.classList.add('collapsed');
      expandToggle.textContent = t('blockEditor.description.expand');
    }
  }

  function toggleCollapse() {
    isCollapsed = !isCollapsed;
    if (isCollapsed) {
      descBody.classList.add('collapsed');
      expandToggle.textContent = t('blockEditor.description.expand');
    } else {
      descBody.classList.remove('collapsed');
      expandToggle.textContent = t('blockEditor.description.collapse');
    }
  }

  updateToggleAvailability();

  expandToggle.addEventListener('click', () => {
    if (isEditing) return;
    toggleCollapse();
  });

  // ---- Editing behavior only if allowed ----
  if (canEditDescription) {
    editBtn.addEventListener('click', () => {
      if (isEditing) return;

      if (isCollapsed) toggleCollapse();

      isEditing = true;
      originalDesc = editTextarea.value;

      viewParagraph.classList.add('hidden');
      editTextarea.classList.remove('hidden');
      editButtons.classList.remove('hidden');
      editBtn.classList.add('hidden');

      expandToggle.parentElement.style.display = 'none';
      editTextarea.focus();
    });

    saveBtn.addEventListener('click', () => {
      isEditing = false;

      const newDesc = editTextarea.value.trim();
      const rendered = md ? md.render(newDesc || '') : '';
      const noDescHtml = `<p><em>${t(emptyKey)}</em></p>`;
      viewParagraph.innerHTML = rendered || noDescHtml;

      editTextarea.classList.add('hidden');
      editButtons.classList.add('hidden');
      viewParagraph.classList.remove('hidden');
      editBtn.classList.remove('hidden');

      originalDesc = newDesc;

      updateDescriptionBackend(newDesc);
      updateToggleAvailability();
    });

    cancelBtn.addEventListener('click', () => {
      isEditing = false;

      editTextarea.value = originalDesc;
      editTextarea.classList.add('hidden');
      editButtons.classList.add('hidden');
      viewParagraph.classList.remove('hidden');
      editBtn.classList.remove('hidden');

      updateToggleAvailability();
    });
  }

  function updateDescriptionBackend(newDescription) {
    if (typeof block_id === 'undefined') {
      console.warn('block_id not defined; description updates will fail.');
      toastError('blockEditor.description.updateError', 'Failed to update description.');
      return;
    }

    fetch(`/api/v1/blocks/${block_id}/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: newDescription })
    })
      .then((response) => {
        if (!response.ok) {
          toastError('blockEditor.description.updateError', 'Failed to update description.');
        }
      })
      .catch((err) => {
        console.error('Failed to update description:', err);
        toastError('blockEditor.description.updateError', 'Failed to update description.');
      });
  }
});
