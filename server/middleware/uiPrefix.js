// server/middleware/uiPrefix.js
const supportedLanguages = [
  'en','es','fr','ru','id','de','it','pt','zh','ja','ko','ar','hi','tr',
  'nl','sv','no','da','fi','pl','cs','el','he','th','vi',
];
const defaultLanguage = 'en';

function pickSupportedLang(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.find(v => supportedLanguages.includes(v)) || null;
  if (typeof raw === 'string') {
    const v = raw.trim();
    return supportedLanguages.includes(v) ? v : null;
  }
  return null;
}

function bestFromHeader(req) {
  const best = req.acceptsLanguages?.(supportedLanguages);
  return best || defaultLanguage;
}

export function uiPrefixAndLangContext(req, res, next) {
  // Capture the incoming path BEFORE we potentially rewrite it
  // (Express keeps req.originalUrl, but we want a clean path for SEO.)
  const originalPath = req.path;

  // Detect /{lang} prefix at the start of the path
  // Accept "/es" and "/es/..."
  const m = originalPath.match(new RegExp(`^\\/(${supportedLanguages.join('|')})(?=\\/|$)`));

  let uiLang = null;
  let hadPrefix = false;
  let unprefixedPath = originalPath;

  if (m) {
    hadPrefix = true;
    uiLang = m[1];

    // Strip "/{lang}" from the URL so downstream routers match existing paths
    unprefixedPath = originalPath.replace(new RegExp(`^\\/${uiLang}(?=\\/|$)`), '') || '/';

    // Rewrite req.url (includes querystring). This is the trick that avoids route duplication.
    req.url = req.url.replace(new RegExp(`^\\/${uiLang}(?=\\/|$)`), '') || '/';
  }

  // If no prefix, fall back to your existing policy
  if (!uiLang) {
    uiLang =
      pickSupportedLang(req.query?.ui) ||
      pickSupportedLang(req.cookies?.ui) ||
      bestFromHeader(req);
  }

  // Expose the context consistently
  res.locals.uiLang = uiLang;
  req.uiLang = uiLang;

  // Keep legacy alias for now if you want
  res.locals.lang = uiLang;
  req.lang = uiLang;

  // SEO and routing helpers
  res.locals.hadUiPrefix = hadPrefix;
  res.locals.unprefixedPath = unprefixedPath;
  res.locals.prefixedPath = `/${uiLang}${unprefixedPath === '/' ? '' : unprefixedPath}`;

  // Template helper: build UI-prefixed internal links
  res.locals.uiPath = (p) => {
    const clean = (p || '/').startsWith('/') ? p : `/${p}`;
    return `/${uiLang}${clean === '/' ? '' : clean}`;
  };

  // If prefix present, set cookie (authoritative)
  // If query ?ui present, also set cookie, but do not rewrite here (redirect middleware will canonicalize)
  const uiFromQuery = pickSupportedLang(req.query?.ui);
  const shouldSet = hadPrefix ? uiLang : uiFromQuery;

  if (shouldSet && shouldSet !== req.cookies?.ui) {
    res.cookie('ui', shouldSet, {
      maxAge: 1000 * 60 * 60 * 24 * 365,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  next();
}
