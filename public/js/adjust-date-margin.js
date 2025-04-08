function adjustDateMargin() {
  const dateEl = document.querySelector('.room-date');
  const titleLine = document.querySelector('.title-line');

  if (!dateEl || !titleLine) return;

  // Compare the vertical positions of titleLine and date
  const titleRect = titleLine.getBoundingClientRect();
  const dateRect = dateEl.getBoundingClientRect();

  // Check if the top of the date is *lower* than the titleLine bottom → means wrap happened
  const isWrapped = dateRect.top > titleRect.bottom;

  if (isWrapped) {
    dateEl.style.marginTop = '0px';
  } else {
    dateEl.style.marginTop = ''; // reset to CSS default
  }
}

// Run on load and on resize (in case of window changes)
window.addEventListener('load', adjustDateMargin);
window.addEventListener('resize', adjustDateMargin);
