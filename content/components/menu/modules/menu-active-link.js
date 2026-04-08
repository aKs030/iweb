/**
 * Pure active-link matcher for site menu navigation.
 * Keeps route matching deterministic and easy to unit test.
 */

function normalizePathname(value) {
  const source = String(value || '');
  const noQuery = source.split('?')[0] || '';
  const noHash = noQuery.split('#')[0] || '';
  return noHash.replace(/\/+$/, '') || '/';
}

function parseMenuHref(rawHref) {
  const href = String(rawHref || '').trim();
  if (!href) return null;

  const [pathPart, hashPart = ''] = href.split('#');
  return {
    rawHref: href,
    path: normalizePathname(pathPart),
    hash: hashPart ? `#${hashPart}` : '',
  };
}

function isPrefixPathMatch(currentPath, candidatePath) {
  if (!candidatePath) return false;
  if (candidatePath === '/') return true;
  if (!currentPath.startsWith(candidatePath)) return false;

  const boundaryChar = currentPath[candidatePath.length];
  return boundaryChar === '/' || boundaryChar === undefined;
}

function shouldReplaceCurrentMatch(current, next) {
  if (!current) return true;
  if (next.rank !== current.rank) return next.rank > current.rank;
  if (next.specificity !== current.specificity) {
    return next.specificity > current.specificity;
  }
  return false;
}

/**
 * Selects the href that should be marked active in the menu.
 *
 * Priority:
 * 1. Exact path + hash match
 * 2. Exact path match (without hash)
 * 3. Prefix path match (without hash), favoring the longest matching path
 *
 * @param {Iterable<string|null|undefined>} hrefs
 * @param {{ currentPath: string, currentHash: string }} context
 * @returns {string|null}
 */
export function selectActiveMenuHref(
  hrefs,
  { currentPath: rawCurrentPath, currentHash },
) {
  const currentPath = normalizePathname(rawCurrentPath);
  const hash = String(currentHash || '');
  let bestMatch = null;

  for (const rawHref of hrefs) {
    const parsed = parseMenuHref(rawHref);
    if (!parsed) continue;

    const specificity = parsed.path === '/' ? 0 : parsed.path.length;

    let candidate = null;

    if (parsed.hash && parsed.path === currentPath && parsed.hash === hash) {
      candidate = { href: parsed.rawHref, rank: 3, specificity };
    } else if (!parsed.hash && parsed.path === currentPath) {
      candidate = { href: parsed.rawHref, rank: 2, specificity };
    } else if (!parsed.hash && isPrefixPathMatch(currentPath, parsed.path)) {
      candidate = { href: parsed.rawHref, rank: 1, specificity };
    }

    if (candidate && shouldReplaceCurrentMatch(bestMatch, candidate)) {
      bestMatch = candidate;
    }
  }

  return bestMatch?.href || null;
}
