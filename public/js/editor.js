document.addEventListener('DOMContentLoaded', () => {
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
});
