document.addEventListener('DOMContentLoaded', () => {
  const hiddenTagsInput = document.getElementById('hidden-tags');
  const tagContainer = document.getElementById('tag-container');
  if (!hiddenTagsInput || !tagContainer) return;

  // Actualiza el valor del input oculto a partir de las "pills" de tag
  function updateHiddenTags() {
    const pills = tagContainer.querySelectorAll('.tag-pill');
    const tags = Array.from(pills).map(pill => pill.firstChild.textContent.trim());
    hiddenTagsInput.value = tags.join(','); // CSV
    updateTagHeader();
  }

  // Actualiza el encabezado según la cantidad de tags
  function updateTagHeader() {
    const tagHeader = document.querySelector('.block-tags-header');
    const pills = tagContainer.querySelectorAll('.tag-pill');
    if (tagHeader) {
      tagHeader.textContent = (pills.length > 0)
        ? "Tags:"
        : "No tags yet! Add some:";
    }
  }

  // Eliminar tag: delegación de eventos sobre el contenedor
  tagContainer.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('tag-remove')) {
      e.preventDefault();
      const pill = e.target.parentElement;
      pill.remove();
      updateHiddenTags();
    }
  });

  // Agregar un nuevo tag al presionar el botón "Add"
  const addTagBtn = document.getElementById('add-tag-btn');
  if (addTagBtn) {
    addTagBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const newTagInput = document.getElementById('new-tag');
      const newTag = newTagInput.value.trim();
      if (!newTag) return;
      // Crea la nueva "pill" para el tag
      const newPill = document.createElement('span');
      newPill.classList.add('tag-pill');
      newPill.textContent = newTag;
      // Botón para remover el tag
      const removeBtn = document.createElement('button');
      removeBtn.classList.add('tag-remove');
      removeBtn.setAttribute('data-tag', newTag);
      removeBtn.textContent = ' x';
      newPill.appendChild(removeBtn);
      // Inserta la nueva pill antes de la sección de "tag-add"
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
});
