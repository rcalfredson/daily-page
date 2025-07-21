document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.table-scroll-container').forEach(container => {
    const wrapper = container.querySelector('.table-scroll-wrapper');
    const update = () => {
      const sl = wrapper.scrollLeft, cw = wrapper.clientWidth, sw = wrapper.scrollWidth;
      container.classList.toggle('fade-left',  sl > 0);
      container.classList.toggle('fade-right', sl + cw < sw);
    };
    if (wrapper.scrollWidth > wrapper.clientWidth) {
      update();
      wrapper.addEventListener('scroll', update);
      window.addEventListener('resize', update);
    }
  });
});
