document.addEventListener('DOMContentLoaded', () => {
  const tabLinks = document.querySelectorAll('.tab-links li a');
  const tabContents = document.querySelectorAll('.tab-content > div');

  tabLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();

      // Remove active classes from all tabs and contents.
      tabLinks.forEach(item => item.parentElement.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Add active class to the clicked tab.
      link.parentElement.classList.add('active');
      const target = document.querySelector(link.getAttribute('href'));
      target.classList.add('active');
    });
  });
});
