document.addEventListener('DOMContentLoaded', () => {
  const t = (key, params) => {
    if (typeof window !== 'undefined' && window.I18n) {
      const maybe = window.I18n.t('blockEditor', key, params);
      if (maybe && maybe !== key) return maybe;
    }
    return null;
  }
  const toolbar = document.querySelector('.toolbar.sticky');
  const editor = document.querySelector('.EasyMDEContainer');
  const buttonsWithTooltips = document.querySelectorAll('[data-tooltip]'); // Botones con tooltips
  const descriptionHeader = document.querySelector('.room-description-header');
  const description = document.querySelector('.room-description');

  // Manejo de tooltips en pantallas táctiles
  const isTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (isTouchScreen) {
    buttonsWithTooltips.forEach((button) => {
      button.removeAttribute('data-tooltip');
    });
  }

  // Detectar iOS
  const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (isiOS && toolbar && editor) {
    const updateToolbarPosition = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const editorTop = editor.getBoundingClientRect().top + scrollTop;

      // Aplicar posición absoluta si el editor está fuera de vista y enfocado
      if (scrollTop > editorTop && document.activeElement === editor) {
        toolbar.style.position = 'absolute';
        toolbar.style.top = `${scrollTop}px`;
      } else {
        // Volver a sticky si no se cumplen las condiciones
        toolbar.style.position = '';
        toolbar.style.top = '';
      }
    };

    // Evento de scroll
    window.addEventListener('scroll', updateToolbarPosition);

    // Manejar focus/blur del editor
    editor.addEventListener('focus', updateToolbarPosition);
    editor.addEventListener('blur', () => {
      toolbar.style.position = ''; // Restablecer a predeterminado
      toolbar.style.top = ''; // Restablecer a predeterminado
    });
  }

  // Comportamiento opcional para descripción
  if (descriptionHeader && description) {
    descriptionHeader.addEventListener('click', () => {
      const isVisible = description.classList.contains('visible');
      description.classList.toggle('visible', !isVisible);
    });
  }

  const titleText = document.getElementById('block-title');
  const titleInput = document.getElementById('block-title-input');
  const editButton = document.getElementById('edit-title-btn');

  if (editButton && titleText && titleInput) {
    editButton.addEventListener('click', () => startEditingTitle());
    titleText.addEventListener('click', () => startEditingTitle());
  }

  function startEditingTitle() {
    titleText.classList.remove('fade-in');
    titleText.classList.add('fade-out');

    titleInput.style.width = titleText.offsetWidth + 'px';

    titleInput.classList.remove('fade-out');
    titleInput.classList.add('fade-in');

    titleInput.focus();
    titleInput.setSelectionRange(0, titleInput.value.length);
  }

  function finishEditingTitle() {
    titleInput.classList.remove('fade-in');
    titleInput.classList.add('fade-out');

    const newTitle = titleInput.value.trim();
    if (newTitle && newTitle !== titleText.innerText) {
      titleText.innerText = newTitle;
      document.title =
        t('meta.title', { blockTitle: newTitle }) || `Edit Block - ${newTitle}`;
      updateTitleBackend(newTitle);
    }
    titleText.classList.remove('fade-out');
    titleText.classList.add('fade-in');
  }

  function updateTitleBackend(newTitle) {
    fetch(`/api/v1/blocks/${block_id}/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle })
    })
      .then(response => response.status)
      .then(status => {
        if (status !== 200) {
          const msg =
            t('errors.updateTitleFailed') || 'Error updating title.';
          alert(msg);
        }
      })
      .catch(err => console.error('Failed to update title:', err));
  }

  if (canManageBlock && titleInput) {
    titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finishEditingTitle();
    });

    titleInput.addEventListener('blur', () => finishEditingTitle());
  }
});
