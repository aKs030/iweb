/**
 * Viewport Meta Tag Management
 * @version 1.0.0
 */

const DEFAULT_VIEWPORT_CONTENT =
  'width=device-width, initial-scale=1, viewport-fit=cover';

/**
 * Merge viewport content with defaults
 * @param {string} content - Existing viewport content
 * @returns {string} Merged viewport content
 */
export function mergeViewportContent(content = '') {
  let merged = content.trim();

  const ensureToken = (regex, token) => {
    if (!regex.test(merged)) {
      merged = merged ? `${merged}, ${token}` : token;
    }
  };

  ensureToken(
    /(^|,)\s*width\s*=\s*device-width\s*(,|$)/i,
    'width=device-width',
  );
  ensureToken(
    /(^|,)\s*initial-scale\s*=\s*1(?:\.0+)?\s*(,|$)/i,
    'initial-scale=1',
  );
  ensureToken(
    /(^|,)\s*viewport-fit\s*=\s*cover\s*(,|$)/i,
    'viewport-fit=cover',
  );

  return merged || DEFAULT_VIEWPORT_CONTENT;
}

/**
 * Ensure viewport meta tag exists and is optimized
 * @param {string} html - HTML content
 * @returns {string} HTML with optimized viewport meta
 */
export function ensureViewportMeta(html) {
  const viewportRegex = /<meta\s+[^>]*name=["']viewport["'][^>]*>/i;
  const viewportMatch = html.match(viewportRegex);

  if (viewportMatch) {
    const contentMatch = viewportMatch[0].match(/content\s*=\s*(["'])(.*?)\1/i);
    const optimizedContent = mergeViewportContent(contentMatch?.[2] || '');

    return html.replace(
      viewportRegex,
      `<meta name="viewport" content="${optimizedContent}" />`,
    );
  }

  const viewportTag = `<meta name="viewport" content="${DEFAULT_VIEWPORT_CONTENT}" />`;

  if (/<meta\s+charset=[^>]*>/i.test(html)) {
    return html.replace(
      /<meta\s+charset=[^>]*>/i,
      (charsetTag) => `${charsetTag}\n    ${viewportTag}`,
    );
  }

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(
      /<head[^>]*>/i,
      (headTag) => `${headTag}\n    ${viewportTag}`,
    );
  }

  return html;
}
