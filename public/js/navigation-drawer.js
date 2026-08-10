document.addEventListener('DOMContentLoaded', () => {
  const drawer = document.querySelector('#main-menu');
  const toggle = document.querySelector('#main-menu-toggle');
  const closeButton = document.querySelector('#main-menu-close');
  const backdrop = drawer?.nextElementSibling?.classList.contains('backdrop')
    ? drawer.nextElementSibling
    : null;
  const mobileViewport = window.matchMedia('(max-width: 979px)');

  if (!drawer || !toggle || !closeButton || !backdrop) return;

  let returnFocusTo = null;

  const focusableElements = () => Array.from(drawer.querySelectorAll(
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => {
    let current = element;

    while (current && current !== drawer) {
      const styles = window.getComputedStyle(current);
      if (styles.display === 'none' || styles.visibility === 'hidden') return false;
      current = current.parentElement;
    }

    return true;
  });

  const isOpen = () => drawer.getAttribute('aria-expanded') === 'true';

  const clearTargetHash = () => {
    if (window.location.hash !== '#main-menu') return;
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`
    );
  };

  const closeDrawer = ({ restoreFocus = true } = {}) => {
    drawer.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('main-menu-open');
    clearTargetHash();

    if (restoreFocus && returnFocusTo instanceof window.HTMLElement) {
      returnFocusTo.focus({ preventScroll: true });
    }

    returnFocusTo = null;
  };

  const openDrawer = () => {
    if (!mobileViewport.matches || isOpen()) return;

    returnFocusTo = document.activeElement instanceof window.HTMLElement
      ? document.activeElement
      : toggle;
    drawer.setAttribute('aria-expanded', 'true');
    drawer.removeAttribute('aria-hidden');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('main-menu-open');

    window.requestAnimationFrame(() => {
      closeButton.focus({ preventScroll: true });
    });
  };

  const syncViewportState = () => {
    if (mobileViewport.matches) {
      if (!isOpen()) drawer.setAttribute('aria-hidden', 'true');
      return;
    }

    closeDrawer({ restoreFocus: false });
    drawer.removeAttribute('aria-hidden');
  };

  toggle.addEventListener('click', (event) => {
    if (!mobileViewport.matches) return;
    event.preventDefault();
    openDrawer();
  });

  closeButton.addEventListener('click', (event) => {
    event.preventDefault();
    closeDrawer();
  });

  backdrop.addEventListener('click', (event) => {
    event.preventDefault();
    closeDrawer();
  });

  drawer.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || link === closeButton) return;
    closeDrawer({ restoreFocus: false });
  });

  document.addEventListener('keydown', (event) => {
    if (!isOpen() || !mobileViewport.matches) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = focusableElements();
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  mobileViewport.addEventListener?.('change', syncViewportState);
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#main-menu') openDrawer();
  });

  drawer.setAttribute('aria-expanded', 'false');
  syncViewportState();

  if (window.location.hash === '#main-menu') openDrawer();
});
