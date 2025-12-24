// server/services/localization.js
// ¡Versión simplificada y DRY!

const supportedLanguages = [
  'en',
  'es',
  'fr',
  'ru',
  'id',
  'de',
  'it',
  'pt',
  'zh',
  'ja',
  'ko',
  'ar',
  'hi',
  'tr',
  'nl',
  'sv',
  'no',
  'da',
  'fi',
  'pl',
  'cs',
  'el',
  'he',
  'th',
  'vi',
];
const defaultLanguage = 'en';

/**
 * Puro y testeable: deduce el idioma preferido del request.
 * Prioridad: ?lang= override > Accept-Language > default.
 */
export function getPreferredLang(req, {
  supported = supportedLanguages,
  fallback = defaultLanguage
} = {}) {
  const ui = req.query?.ui;
  if (ui && supported.includes(ui)) return ui;

  // Back-compat: old behavior
  const legacy = req.query?.lang;
  if (legacy && supported.includes(legacy)) return legacy;

  const best = req.acceptsLanguages(supported);
  return best || fallback;
}

/**
 * Middleware liviano que solo setea res.locals.lang (y req.lang).
 * Úsalo globalmente: app.use(setLangMiddleware)
 */
export default function setLangMiddleware(req, res, next) {
  const lang = getPreferredLang(req);
  res.locals.lang = lang; // tu layout Pug ya lo usare en <html lang=...>
  req.lang = lang;        // opcional: útil en rutas/controladores
  next();
}
