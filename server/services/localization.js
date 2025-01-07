import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';

const supportedLanguages = ['en', 'es', 'ru'];
const defaultLanguage = 'en';

// Resolve directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const requiredKeys = [
  "title",
  "headline",
  "paragraph1",
  "essence",
  "paragraph2",
  "role",
  "paragraph3",
  "testament",
  "paragraph4",
  "cta_join",
  "cta_archive",
  "paragraph5"
];

const validateTranslations = (translations) => {
  const missingKeys = requiredKeys.filter(key => !translations[key]);
  if (missingKeys.length) {
    console.warn(`Missing translation keys: ${missingKeys.join(", ")}`);
    // Add default fallbacks here if necessary
  }
  return translations;
};

/**
 * Localization middleware to handle translations for the home page.
 */
const localizationMiddleware = async (req, res, next) => {
  const isHomePage = req.path === '/' || req.path === '/*?';
  const page = isHomePage ? 'homepage' : null;

  let lang = req.acceptsLanguages(supportedLanguages) || defaultLanguage;

  // Allow query param override for testing
  if (req.query.lang && supportedLanguages.includes(req.query.lang)) {
    lang = req.query.lang;
  }

  if (isHomePage && page) {
    try {
      const translationsPath = path.join(__dirname, `../../translations/${page}-${lang}.json`);
      const translations = JSON.parse(await fs.readFile(translationsPath, 'utf8'));
      res.locals.lang = lang;
      res.locals.translations = validateTranslations(translations);
    } catch (error) {
      console.error(`Missing translation file: ${page}-${lang}.json`);
      const fallbackPath = path.join(__dirname, `../translations/${page}-${defaultLanguage}.json`);
      const fallbackTranslations = JSON.parse(await fs.readFile(fallbackPath, 'utf8'));
      res.locals.translations = validateTranslations(fallbackTranslations);
    }
  } else {
    res.locals.lang = defaultLanguage;
    res.locals.translations = {};
  }

  next();
};

export default localizationMiddleware;
