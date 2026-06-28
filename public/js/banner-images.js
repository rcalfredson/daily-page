document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-banner-image] img').forEach((image) => {
    const hideBrokenBanner = () => {
      const banner = image.closest('[data-banner-image]');
      if (banner) banner.hidden = true;
    };

    image.addEventListener('error', hideBrokenBanner);
    if (image.complete && image.naturalWidth === 0) hideBrokenBanner();
  });
});
