document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-banner-image] img').forEach((image) => {
    const banner = image.closest('[data-banner-image]');

    const hideBrokenBanner = () => {
      if (banner) banner.hidden = true;
    };

    const fitListBanner = () => {
      if (!banner || banner.classList.contains('block-banner--hero')) return;

      const ratio = image.naturalWidth / image.naturalHeight;
      if (!Number.isFinite(ratio) || ratio <= 0) return;

      const minimumRatio = 16 / 9;
      const maximumRatio = 2.5;
      const fittedRatio = Math.min(maximumRatio, Math.max(minimumRatio, ratio));
      banner.style.setProperty('--banner-aspect-ratio', String(fittedRatio));
    };

    image.addEventListener('error', hideBrokenBanner);
    image.addEventListener('load', fitListBanner);

    if (image.complete) {
      if (image.naturalWidth === 0) hideBrokenBanner();
      else fitListBanner();
    }
  });
});
