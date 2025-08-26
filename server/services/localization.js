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
  // 1) Override via query param (útil p/ testing, enlaces, etc.)
  const q = req.query?.lang;
  if (q && supported.includes(q)) return q;

  // 2) Negociación con Accept-Language (Express usa negotiator)
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
