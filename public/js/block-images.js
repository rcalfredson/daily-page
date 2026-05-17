/* global document, window */

(function () {
  const imageSelector = '.block-content img, .content-preview img, .featured-content-preview img';
  let lightbox;
  let lightboxImage;
  let closeButton;
  let previouslyFocused;

  const label = (key, fallback) => {
    const translated = window.i18nT?.(key);
    return translated && translated !== key ? translated : fallback;
  };

  const ensureLightbox = () => {
    if (lightbox) return;

    lightbox = document.createElement('div');
    lightbox.className = 'block-image-lightbox';
    lightbox.hidden = true;
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', label('layout.blockImages.preview', 'Image preview'));

    const frame = document.createElement('div');
    frame.className = 'block-image-lightbox__frame';

    closeButton = document.createElement('button');
    closeButton.className = 'block-image-lightbox__close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', label('layout.blockImages.close', 'Close image preview'));

    lightboxImage = document.createElement('img');
    lightboxImage.className = 'block-image-lightbox__image';
    lightboxImage.alt = '';

    frame.append(closeButton, lightboxImage);
    lightbox.append(frame);
    document.body.append(lightbox);

    closeButton.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', event => {
      if (event.target === lightbox) closeLightbox();
    });
  };

  const closeLightbox = () => {
    if (!lightbox || lightbox.hidden) return;

    lightbox.hidden = true;
    document.body.style.removeProperty('overflow');
    lightboxImage.removeAttribute('src');

    if (previouslyFocused && document.contains(previouslyFocused)) {
      previouslyFocused.focus();
    }
    previouslyFocused = null;
  };

  const openLightbox = img => {
    ensureLightbox();

    previouslyFocused = document.activeElement;
    lightboxImage.src = img.currentSrc || img.src;
    lightboxImage.alt = img.alt || '';
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    closeButton.focus();
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll(imageSelector).forEach(img => {
      img.tabIndex = img.tabIndex >= 0 ? img.tabIndex : 0;
      img.setAttribute('role', 'button');
      if (!img.getAttribute('aria-label')) {
        img.setAttribute('aria-label', label('layout.blockImages.open', 'Open image preview'));
      }
    });
  });

  document.addEventListener('click', event => {
    const img = event.target.closest(imageSelector);
    if (!img) return;

    event.preventDefault();
    openLightbox(img);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeLightbox();
      return;
    }

    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches(imageSelector)) {
      event.preventDefault();
      openLightbox(event.target);
    }
  });
}());
