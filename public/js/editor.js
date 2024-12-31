document.addEventListener('DOMContentLoaded', () => {
  const descriptionHeader = document.querySelector('.room-description-header');
  const description = document.querySelector('.room-description');

  if (descriptionHeader && description) {
    descriptionHeader.addEventListener('click', () => {
      const isVisible = description.classList.contains('visible');
      description.classList.toggle('visible', !isVisible);
    });
  }
});
