// lib/langContext.js
export function getUiLang() {
  if (typeof window !== 'undefined' && window.I18n && typeof window.I18n.lang === 'function') {
    return window.I18n.lang();
  }
  return 'en';
}

export function getContentLang() {
  if (typeof document === 'undefined') return 'en';
  const el = document.getElementById('content-lang');
  if (!el) return document.documentElement?.lang || 'en';
  try {
    return JSON.parse(el.textContent) || 'en';
  } catch {
    return document.documentElement?.lang || 'en';
  }
}
