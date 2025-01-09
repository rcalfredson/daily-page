document.addEventListener('DOMContentLoaded', () => {
  const toolbar = document.querySelector('.toolbar.sticky');
  const editor = document.querySelector('.EasyMDEContainer');
  const buttonsWithTooltips = document.querySelectorAll('[data-tooltip]');

  const toolbarHeight = toolbar.offsetHeight;

  window.addEventListener('scroll', () => {
    const editorTop = editor.getBoundingClientRect().top;

    if (editorTop < toolbarHeight) {
      toolbar.classList.add('scrolled');
    } else {
      toolbar.classList.remove('scrolled');
    }
  });

  const descriptionHeader = document.querySelector('.room-description-header');
  const description = document.querySelector('.room-description');

  if (descriptionHeader && description) {
    descriptionHeader.addEventListener('click', () => {
      const isVisible = description.classList.contains('visible');
      description.classList.toggle('visible', !isVisible);
    });
  }
});
