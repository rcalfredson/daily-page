// server/services/localizedPaths.js
export function isLocalizedPath(path) {
  // Start tiny: only the route you want to roll out first
  // Add more patterns as you expand.
  return path === '/';
}
