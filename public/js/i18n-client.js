/* Tiny i18n helper for front-end scripts
 * Reads JSON namespaces injected via <script type="application/json" id="i18n-...">.
 * API:
 *   I18n.lang()                            -> "en" | "es" | ...
 *   I18n.read(id, fallback)                -> object (cached)
 *   I18n.get(nsId, fallback)               -> object (reads "i18n-${nsId}" script)
 *   I18n.t(nsIdOrObj, path, params?)       -> string (deep-get + {var} interpolation)
 *   I18n.interpolate(str, params)          -> string
 *
 * Expected script tags (examples):
 *   <script id="i18n-lang" type="application/json">"es"</script>
 *   <script id="i18n-modals" type="application/json">{ ... }</script>
 *   <script id="i18n-roomDashboard" type="application/json">{ ... }</script>
 */
(function () {
  const CACHE = new Map();

  function _readJsonScript(id, fallback) {
    if (CACHE.has(id)) return CACHE.get(id);
    const el = document.getElementById(id);
    if (!el) {
      CACHE.set(id, fallback);
      return fallback;
    }
    try {
      const parsed = JSON.parse(el.textContent || el.innerText || 'null');
      CACHE.set(id, parsed ?? fallback);
      return parsed ?? fallback;
    } catch {
      CACHE.set(id, fallback);
      return fallback;
    }
  }

  function _deepGet(obj, path) {
    if (!obj) return undefined;
    return String(path)
      .split('.')
      .reduce((o, k) => (o && k in o ? o[k] : undefined), obj);
  }

  function _interpolate(str, params) {
    const s = (str == null) ? '' : String(str);
    if (!params) return s;
    return s.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
  }

  function lang() {
    // Typically provided by the server into #i18n-lang
    return _readJsonScript('i18n-lang', 'en');
  }

  function read(id, fallback = {}) {
    return _readJsonScript(id, fallback);
  }

  function get(nsId, fallback = {}) {
    // convention: script tag id = "i18n-" + nsId
    return _readJsonScript(`i18n-${nsId}`, fallback);
  }

  function t(nsOrObj, path, params) {
    const nsObj = (typeof nsOrObj === 'string') ? get(nsOrObj, {}) : (nsOrObj || {});
    const val = _deepGet(nsObj, path);
    // If key missing, return the path itself (nice for dev to spot)
    return _interpolate(val !== undefined ? val : path, params);
  }

  // Optional: allow setting/updating namespaces at runtime (rarely needed)
  function set(nsId, data) {
    CACHE.set(`i18n-${nsId}`, data || {});
  }

  window.I18n = {
    lang,
    read,
    get,
    t,
    set,
    interpolate: _interpolate
  };
})();
