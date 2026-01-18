// server/services/localizedPaths.js
export function isLocalizedPath(path) {
  return (
    path === '/' ||
    path === '/privacy' ||
    path === '/rooms' ||
    path === '/tags' ||
    path === '/archive' ||
    path === '/about' ||
    path === '/archive/best-of' ||
    path === '/support' ||
    path === '/random' ||
    /^\/archive\/\d{4}\/\d{1,2}$/.test(path) ||
    /^\/rooms\/[^/]+\/archive\/\d{4}\/\d{1,2}$/.test(path) ||
    /^\/rooms\/[^/]+\/archive\/best-of$/.test(path)
  );
}
