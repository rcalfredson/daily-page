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
    path === '/login' ||
    path === '/signup' ||
    path === '/verify-email' ||

    // room archive, index, create-block
    /^\/rooms\/[^/]+\/archive$/.test(path) ||
    /^\/rooms\/[^/]+\/index$/.test(path) ||
    /^\/rooms\/[^/]+\/blocks\/new$/.test(path) ||

    // month index
    /^\/archive\/\d{4}\/\d{1,2}$/.test(path) ||
    /^\/rooms\/[^/]+\/archive\/\d{4}\/\d{1,2}$/.test(path) ||

    // day view
    /^\/archive\/\d{4}\/\d{1,2}\/\d{1,2}$/.test(path) ||
    /^\/rooms\/[^/]+\/archive\/\d{4}\/\d{1,2}\/\d{1,2}$/.test(path) ||

    // best-of
    /^\/rooms\/[^/]+\/archive\/best-of$/.test(path) ||

    // tag pages
    /^\/tags\/[^/]+$/.test(path)
  );
}
