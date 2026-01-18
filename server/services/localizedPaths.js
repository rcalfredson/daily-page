// server/services/localizedPaths.js
export function isLocalizedPath(path) {
  return (
    path === '/' ||
    path === '/privacy' ||
    path === '/rooms' ||
    path === '/tags' ||
    path === '/archive' ||
    path === '/archive/best-of' ||
    /^\/rooms\/[^/]+\/archive\/best-of$/.test(path)
  );
}
