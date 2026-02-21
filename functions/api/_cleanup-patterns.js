/**
 * Text Cleanup Patterns for Search Snippets
 * @version 1.0.0
 */

/**
 * Patterns to strip from raw text before showing it as a search snippet.
 * Each entry is [regex, replacement]. Evaluated in order.
 * @type {Array<[RegExp, string]>}
 */
export const CLEANUP_PATTERNS = [
  // 1. Script / style / noscript blocks
  [/<script\b[^>]*>[\s\S]*?<\/script>/gim, ''],
  [/<style\b[^>]*>[\s\S]*?<\/style>/gim, ''],
  [/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gim, ''],
  // 2. HTML tags
  [/<[^>]+>/g, ' '],
  // 3. Front matter / YAML
  [/^---[\s\S]*?---\s*/, ''],
  [/title:\s*[^:]+:--- description:\s*/i, ''],
  [/:--- description:\s*/gi, ''],
  [/\b(layout|permalink|date|author):\s*[^ \n]+\s*/gi, ''],
  // 4. JSON / JSON-LD / structured data (aggressive — catches fragments)
  [/```[\s\S]*?```/g, ''],
  [/\{\s*"@(context|type|graph)"[\s\S]*?\}\s*\]?\s*\}?/g, ''],
  [/\[\s*\{\s*"@type"[\s\S]*?\}\s*\]/g, ''],
  [/\{[^{}]*"(position|@type|url|name|item)"[^{}]*\}/g, ''],
  [/"\w+":\s*"[^"]*"/g, ''],
  [/[{}[\],]\s*[{}[\],]/g, ' '],
  [/[{}[\]]/g, ' '],
  // 5. Site-specific UI artifacts
  [/\[?Zum Hauptinhalt springen\]?(\([^)]*\))?/gi, ''],
  [/\(#[a-z-]+\)/gi, ''],
  [/menu\.skip_mainmenu\.skip_nav/gi, ''],
  [/AKS \| WEB/g, ''],
  [/©\s*\d{4}\s*Abdulkerim Sesli/gi, ''],
  [/Initialisiere System(\.\.\.)?/gi, ''],
  [/\d+%\s*\d+%/g, ''],
  // Cookie / analytics banners
  [/🍪\s*Wir nutzen Analytics[\s\S]*?Datenschutz/gi, ''],
  // Greeting / time-of-day banners
  [/Soll ich dir was zeigen\?×\s*\?\s*Hauptmenü geschlossen/gi, ''],
  [/Willkommen auf der Seite!×\s*\?/gi, ''],
  [/Schön, dass du (nachts |morgens |abends )?hier bist[^!]*!/gi, ''],
  [
    /Vielen herzlichen Dank, dass Sie sich die Zeit genommen haben[\s\S]*?nächsten Besuch!/gi,
    '',
  ],
  // Globe / 3D mode toggles
  [/🌍\s*CSS-Modus/gi, ''],
  [/Eine interaktive 3D-Darstellung der Erde[\s\S]*?Kamera-Modi\./gi, ''],
  [/Scroll to explore • Click to view/gi, ''],
  // Navigation / menu / breadcrumb remains
  [/Startseite\s*Start/gi, ''],
  [/Nach oben\s*Über mich/gi, ''],
  [/Weiter\s*Kontakt\s*Auf Wiedersehen!/gi, ''],
  [/Hauptmenü\s*(geöffnet|geschlossen)/gi, ''],
  // Gallery / section headings used as filler
  [/Premium Fotogalerie Professionelle Fotografie in höchster Qualität/gi, ''],
  [/Fotos\s*Eindrücke/gi, ''],
  // Quotes / mottos
  [/Zitat vollständig:/gi, ''],
  [/Habe Mut, dich deines eigenen Verstandes zu bedienen\./gi, ''],
  // AI / meta labels
  [/✨\s*AI OVERVIEW/gi, ''],
  [/Kant\s*/gi, ''],
  // 6. Stray punctuation / noise left over
  [/^\s*[,;:.\-|]+\s*/g, ''],
  [/\s*[,;:.\-|]+\s*$/g, ''],
];

/** HTML entity map for decoding */
export const HTML_ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&copy;': '(c)',
};
