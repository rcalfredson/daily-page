document.addEventListener('DOMContentLoaded', () => {
  const headers = document.querySelectorAll('.topic-header');

  headers.forEach(header => {
    const topicSection = header.nextElementSibling;
    const icon = header.querySelector('.expand-icon');
    
    // Start collapsed
    topicSection.classList.add('collapsed');
    topicSection.style.maxHeight = 0;
    icon.classList.add('collapsed');

    header.addEventListener('click', () => {
      if (topicSection.classList.contains('collapsed')) {
        // Expand
        topicSection.classList.remove('collapsed');
        icon.classList.remove('collapsed');
        // Make tiles visible immediately
        topicSection.querySelectorAll('.room-tile').forEach(tile => {
          tile.style.visibility = 'visible';
        });
        // Then expand
        topicSection.style.maxHeight = topicSection.scrollHeight + 'px';
      } else {
        // Hide the tiles instantly before we collapse
        topicSection.querySelectorAll('.room-tile').forEach(tile => {
          tile.style.visibility = 'hidden';
        });
        topicSection.classList.add('collapsed');
        icon.classList.add('collapsed');
        topicSection.style.maxHeight = 0;
      }
    });
  });
});
