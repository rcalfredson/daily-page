document.addEventListener('DOMContentLoaded', () => {
  const descCard = document.querySelector('.block-description-card');
  const descBody = descCard.querySelector('.description-body');
  const editBtn = descCard.querySelector('#edit-description-btn');
  const viewParagraph = descCard.querySelector('#description-view');
  const editTextarea = descCard.querySelector('#description-edit');
  const editButtons = descCard.querySelector('.edit-buttons');
  const saveBtn = descCard.querySelector('#save-description-btn');
  const cancelBtn = descCard.querySelector('#cancel-description-btn');
  const expandToggle = descCard.querySelector('.expand-toggle span');

  let isCollapsed = true;
  let isEditing = false;
  let originalDesc = editTextarea ? editTextarea.value : '';

  // Función para evaluar si el contenido es lo suficientemente largo como para necesitar expand/collapse.
  function updateToggleAvailability() {
    // Si el scrollHeight del párrafo es menor o igual a 150px, no hay overflow.
    if (viewParagraph.scrollHeight <= 150) {
      // Deshabilita (oculta) el toggle
      expandToggle.parentElement.style.display = 'none';
      // Asegura que el contenido se muestre expandido
      isCollapsed = false;
      descBody.classList.remove('collapsed');
    } else {
      // Si es largo, muestra el toggle
      expandToggle.parentElement.style.display = 'block';
      // Inicialmente colapsado (si no estamos editando)
      if (!isEditing) {
        isCollapsed = true;
        descBody.classList.add('collapsed');
        expandToggle.textContent = 'Expand';
      }
    }
  }

  // Inicializa el estado del toggle al cargar la página.
  updateToggleAvailability();

  // Toggle expand/collapse; se desactiva si estamos editando.
  if (expandToggle) {
    expandToggle.addEventListener('click', () => {
      if (isEditing) return; // No permite toggle en modo edición.
      toggleCollapse();
    });
  }

  // Función para alternar el estado de expandir/colapsar.
  function toggleCollapse() {
    isCollapsed = !isCollapsed;
    if (isCollapsed) {
      descBody.classList.add('collapsed');
      expandToggle.textContent = 'Expand';
    } else {
      descBody.classList.remove('collapsed');
      expandToggle.textContent = 'Collapse';
    }
  }

  // Al hacer clic en el botón de editar: si está colapsado, expande primero.
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      if (!isEditing) {
        // Si está colapsado, expande.
        if (isCollapsed) {
          toggleCollapse();
        }
        isEditing = true;
        originalDesc = editTextarea.value;
        viewParagraph.classList.add('hidden');
        editTextarea.classList.remove('hidden');
        editButtons.classList.remove('hidden');
        editBtn.classList.add('hidden'); // Oculta el botón de editar durante la edición.

        // Deshabilita el toggle durante la edición.
        expandToggle.parentElement.style.display = 'none';

        editTextarea.focus();
      }
    });
  }

  // Save changes
  if (saveBtn && cancelBtn) {
    saveBtn.addEventListener('click', () => {
      isEditing = false;
      const newDesc = editTextarea.value.trim();
      viewParagraph.textContent = newDesc || 'No description provided...';
      editTextarea.classList.add('hidden');
      editButtons.classList.add('hidden');
      viewParagraph.classList.remove('hidden');
      editBtn.classList.remove('hidden'); // Muestra el botón de editar nuevamente.

      updateDescriptionBackend(newDesc);
      // Restaura el toggle según corresponda.
      updateToggleAvailability();
    });

    // Cancel editing
    cancelBtn.addEventListener('click', () => {
      isEditing = false;
      editTextarea.value = originalDesc;
      editTextarea.classList.add('hidden');
      editButtons.classList.add('hidden');
      viewParagraph.classList.remove('hidden');
      editBtn.classList.remove('hidden'); // Muestra el botón de editar nuevamente.
      
      // Restaura el toggle según corresponda.
      updateToggleAvailability();
    });
  }

  // Update description on the backend
  function updateDescriptionBackend(newDescription) {
    fetch(`/api/v1/blocks/${block_id}/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: newDescription })
    })
      .then(response => {
        if (!response.ok) {
          alert('Error updating description.');
        }
      })
      .catch(err => console.error('Failed to update description:', err));
  }
});
