// public/js/uiLangFallbackBanner.js
(function () {
  const banner = document.querySelector('.ui-lang-fallback-banner');
  if (!banner) return;

  const requested = banner.getAttribute('data-requested') || '';
  const btn = banner.querySelector('.ui-lang-fallback-dismiss');
  if (!btn) return;

  btn.addEventListener('click', () => {
    // Store "hide for this requested lang" cookie
    document.cookie = `ui_fallback_hide=${encodeURIComponent(requested)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    banner.remove();
  });
})();
