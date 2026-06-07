(function () {
  const storageKey = 'daily-page-theme';
  const themes = ['light', 'dark'];
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function storedTheme() {
    try {
      const value = localStorage.getItem(storageKey);
      return themes.includes(value) ? value : null;
    } catch {
      return null;
    }
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem(storageKey, theme);
    } catch {
      // Ignore storage failures; the current page can still switch theme.
    }
  }

  function systemTheme() {
    return media?.matches ? 'dark' : 'light';
  }

  function label(key, fallback) {
    const translated = window.i18nT?.(key);
    return translated && translated !== key ? translated : fallback;
  }

  function applyTheme(theme) {
    const next = themes.includes(theme) ? theme : systemTheme();
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;

    const toggle = document.querySelector('[data-theme-toggle]');
    if (!toggle) return;

    const isDark = next === 'dark';
    const nextLabel = isDark
      ? label('layout.theme.toggleToLight', 'Switch to light mode')
      : label('layout.theme.toggleToDark', 'Switch to dark mode');
    const icon = toggle.querySelector('[data-theme-icon]');
    const text = toggle.querySelector('[data-theme-label]');

    toggle.setAttribute('aria-label', nextLabel);
    toggle.setAttribute('title', nextLabel);
    toggle.setAttribute('aria-pressed', String(isDark));
    if (text) text.textContent = nextLabel;
    if (icon) {
      icon.classList.toggle('fa-moon-o', !isDark);
      icon.classList.toggle('fa-sun-o', isDark);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('[data-theme-toggle]');
    applyTheme(storedTheme() || document.documentElement.dataset.theme || systemTheme());

    toggle?.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      setStoredTheme(next);
      applyTheme(next);
    });

    const onSystemThemeChange = () => {
      if (!storedTheme()) applyTheme(systemTheme());
    };

    if (media?.addEventListener) {
      media.addEventListener('change', onSystemThemeChange);
    } else if (media?.addListener) {
      media.addListener(onSystemThemeChange);
    }
  });
})();
