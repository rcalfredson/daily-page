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
    /^\/rooms\/[^/]+\/archive\/best-of$/.test(path)
  );
}
