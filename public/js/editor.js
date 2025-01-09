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

  // buttonsWithTooltips.forEach((button) => {
  //   button.addEventListener('mouseenter', () => {
  //     const tooltipText = button.getAttribute('data-tooltip');
  //     const tooltip = document.createElement('div');

  //     // Create Tooltip Element
  //     tooltip.className = 'dynamic-tooltip';
  //     tooltip.innerText = tooltipText;
  //     document.body.appendChild(tooltip);

  //     // Position Tooltip Below Button
  //     const buttonRect = button.getBoundingClientRect();
  //     tooltip.style.position = 'absolute';
  //     tooltip.style.left = `${buttonRect.left + buttonRect.width / 2 - tooltip.offsetWidth / 2}px`;
  //     tooltip.style.top = `${buttonRect.bottom + 10}px`; // Always below button

  //     button.addEventListener('mouseleave', () => {
  //       tooltip.remove();
  //     });
  //   });
  // });
});
