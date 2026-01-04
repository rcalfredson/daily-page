// server/services/i18n.js
import fs from 'fs/promises';
import path from 'path';

const cache = new Map(); // key: `${lang}:${ns}` -> dict
const DEFAULT_LANG = 'en';

function interpolate(str, params = {}) {
  return String(str).replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`));
}

async function loadNS(lang, ns) {
  const key = `${lang}:${ns}`;
  if (cache.has(key)) return cache.get(key);
  const file = path.join(process.cwd(), 'i18n', lang, `${ns}.json`);
  let data = {};
  try {
    data = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {/* missing file -> {} */ }
  cache.set(key, data);
  return data;
}

function deepGet(obj, dotted, fallback) {
  return dotted.split('.').reduce((o, k) => (o && k in o) ? o[k] : undefined, obj) ?? fallback;
}

function deepMerge(target, source) {
  if (!source) return target || {};
  const out = Array.isArray(target) ? [...target] : { ...(target || {}) };
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function loadBundles(lang, namespaces, defaultLang = DEFAULT_LANG) {
  const bundles = [];
  for (const ns of namespaces) {
    const base = await loadNS(defaultLang, ns);
    const override = (lang === defaultLang) ? {} : await loadNS(lang, ns);
    bundles.push(deepMerge(base, override));
  }
  return bundles.reduce((acc, cur) => deepMerge(acc, cur), {});
}

export function initI18n(baseNamespaces = [], { defaultLang = DEFAULT_LANG } = {}) {
  return async (req, res, next) => {
    const lang = res.locals.uiLang || res.locals.lang || defaultLang;
    const base = await loadBundles(lang, baseNamespaces, defaultLang);
    res.locals.__i18n = base;

    res.locals.t = (key, params) => {
      const val = deepGet(res.locals.__i18n, key, null);
      if (val == null) return process.env.NODE_ENV === 'production' ? '' : key;
      return interpolate(val, params);
    };

    // keep exposing both for now
    res.locals.uiLang = lang;
    res.locals.lang = lang;

    next();
  };
}

export function addI18n(extraNamespaces = [], { defaultLang = DEFAULT_LANG } = {}) {
  return async (req, res, next) => {
    const lang = res.locals.uiLang || res.locals.lang || defaultLang;
    const extra = await loadBundles(lang, extraNamespaces, defaultLang);
    res.locals.__i18n = deepMerge(res.locals.__i18n, extra);
    next();
  };
}

export async function getTranslatorRuntime(lang = DEFAULT_LANG, namespaces = [], { defaultLang = DEFAULT_LANG } = {}) {
  const bundles = await loadBundles(lang, namespaces, defaultLang);

  return function t(key, params) {
    const val = deepGet(bundles, key, null);
    if (val == null) return process.env.NODE_ENV === 'production' ? '' : key;
    return interpolate(val, params);
  };
}
