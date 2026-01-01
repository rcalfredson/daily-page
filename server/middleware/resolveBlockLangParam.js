// server/middleware/resolveBlockLangParam.js
import { buildRedirectQuery } from '../services/urlPolicy.js';
import { withQuery } from '../utils/urls.js';

/**
 * For block routes:
 * - If ?lang= is present:
 *   - Attempt translation resolution (groupId + lang)
 *   - 302 to canonical path for target (or self) WITHOUT ?lang=
 *   - Preserve ?ui= only if explicitly present
 *
 * This middleware is intentionally "redirect-only": it does not change request state.
 */
export function resolveBlockLangParam({
  loadBlock,                 // async (req) => block|null (MUST verify room match if relevant)
  getTranslation,            // async (groupId, lang) => block|null
  canonicalPathForBlock,     // (block) => string
}) {
  return async function resolveBlockLangParamMiddleware(req, res, next) {
    const requestedLang = req.query?.lang;
    if (!requestedLang) return next();

    let block;
    try {
      block = await loadBlock(req);
    } catch (err) {
      return next(err);
    }

    // If we can't resolve the base block (or room mismatch), let the handler 404.
    if (!block) return next();

    let finalBlock = block;

    // Try to resolve translation only when it differs from the current block language
    if (requestedLang !== block.lang) {
      try {
        const target = await getTranslation(block.groupId, requestedLang);
        if (target) finalBlock = target;
      } catch (err) {
        return next(err);
      }
    }

    const targetPath = canonicalPathForBlock(finalBlock);
    const redirectQuery = buildRedirectQuery(req); // strips lang + preserves explicit ui
    return res.redirect(302, withQuery(targetPath, redirectQuery));
  };
}
