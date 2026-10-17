import { readFileSync } from 'node:fs';
import { SUPPORTED_UI_LANGS } from './localeContext.js';

// Only advertise static editions with actual page-copy bundles. UI support alone
// is not evidence that the resource has been translated.
const namespaces = { '/': 'home', '/about': 'about', '/support': 'support', '/privacy': 'privacy', '/rooms': 'roomsDirectory' };
const localesByPath = new Map();
for (const [path, namespace] of Object.entries(namespaces)) {
  localesByPath.set(path, SUPPORTED_UI_LANGS.filter(lang => {
    try {
      const data = JSON.parse(readFileSync(new URL(`../../i18n/${lang}/${namespace}.json`, import.meta.url), 'utf8'));
      return Boolean(data[namespace]?.meta?.title && data[namespace]?.meta?.description);
    } catch { return false; }
  }));
}

export function staticSeoLocales(path) {
  return localesByPath.get(path) || [];
}
