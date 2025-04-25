function detectActionWrap() {
  const title = document.querySelector('.block-title');
  const controls = document.querySelector('.interact-section');
  const buttons = document.querySelector('.action-buttons');

  if (!title || !controls || !buttons) return;

  const titleTop = title.getBoundingClientRect().top;
  const controlsTop = controls.getBoundingClientRect().top;

  const wrapped = controlsTop > titleTop + 5;

  console.log('title top:', titleTop);
  console.log('controls top:', controlsTop);
  console.log('wrapped?', wrapped);

  controls.classList.toggle('left-align', wrapped);
  buttons.classList.toggle('left-align', wrapped);
}

document.addEventListener('DOMContentLoaded', () => {
  window.addEventListener('load', detectActionWrap);
  window.addEventListener('resize', detectActionWrap);
});
