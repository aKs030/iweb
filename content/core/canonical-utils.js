// Canonical path utilities (pure functions)
const ensureTrailingSlash = (p) => (p.endsWith('/') ? p : p + '/');

export function getCanonicalPathFromRoutes(pathname, routes) {
  const rawPath = pathname || '/';
  let pathForMatch = rawPath.replace(/\/\/+/g, '/');
  pathForMatch = pathForMatch.replace(/\/index\.html$/i, '/');
  pathForMatch = pathForMatch.replace(/\.html$/i, '/');
  pathForMatch = pathForMatch.replace(/\/\/+/g, '/');
  if (!pathForMatch.startsWith('/')) pathForMatch = '/' + pathForMatch;
  pathForMatch = ensureTrailingSlash(pathForMatch);

  const lowerMatch = pathForMatch.toLowerCase();
  // Prefer startsWith matches (exact or sub-path), fallback to includes
  let routeKey = Object.keys(routes).find(
    (k) => k !== 'default' && lowerMatch.startsWith(k),
  );
  if (!routeKey)
    routeKey = Object.keys(routes).find(
      (k) => k !== 'default' && lowerMatch.includes(k),
    );

  if (routeKey) return ensureTrailingSlash(routeKey);
  return pathForMatch;
}
