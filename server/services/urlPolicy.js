// server/services/urlPolicy.js
import { getUiQueryLang } from './localization.js';

/**
 * Build a redirect query that enforces canonical rules:
 * - Strip legacy ?lang=
 * - Preserve ?ui= ONLY if it was explicitly present and valid on inbound request
 */
export function buildRedirectQuery(req) {
  const q = { ...req.query };

  // Legacy content selector never belongs on canonical URLs
  delete q.lang;

  // Preserve ui only if explicitly present & supported
  const uiFromQuery = getUiQueryLang(req);
  if (uiFromQuery) q.ui = uiFromQuery;
  else delete q.ui;

  return q;
}
