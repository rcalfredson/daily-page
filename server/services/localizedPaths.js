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

    // month index
    /^\/archive\/\d{4}\/\d{1,2}$/.test(path) ||
    /^\/rooms\/[^/]+\/archive\/\d{4}\/\d{1,2}$/.test(path) ||

    // day view
    /^\/archive\/\d{4}\/\d{1,2}\/\d{1,2}$/.test(path) ||
    /^\/rooms\/[^/]+\/archive\/\d{4}\/\d{1,2}\/\d{1,2}$/.test(path) ||

    // best-of
    /^\/rooms\/[^/]+\/archive\/best-of$/.test(path)
  );
}
