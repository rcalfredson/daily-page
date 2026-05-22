export const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur']);

export function textDirForLang(lang) {
  const base = String(lang || '').split('-')[0].toLowerCase();
  return RTL_LANGS.has(base) ? 'rtl' : 'ltr';
}
