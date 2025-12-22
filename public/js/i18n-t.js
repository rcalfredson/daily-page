// public/js/i18n-t.js
(function () {
  function t(key, vars = {}) {
    try {
      if (!window.I18n || typeof window.I18n.t !== 'function') return String(key);

      const str = String(key);
      const i = str.indexOf('.');
      if (i === -1) return str;

      const ns = str.slice(0, i);
      const path = str.slice(i + 1);
      return window.I18n.t(ns, path, vars);
    } catch {
      return String(key);
    }
  }

  // Keep it explicit so we don't collide with other libs named "t"
  window.i18nT = t;
})();
