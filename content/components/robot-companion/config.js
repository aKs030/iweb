/**
 * Gemini API Konfiguration
 *
 * SICHERHEIT: API-Key wurde entfernt und ist jetzt nur im Cloudflare Worker verfügbar.
 * Alle Client-Requests MÜSSEN über den /api/gemini Proxy-Endpunkt laufen.
 *
 * Der API-Key ist als Secret im Cloudflare Worker gespeichert:
 * - Setzen mit: wrangler secret put GEMINI_API_KEY
 * - Konfiguriert in: wrangler.toml
 */
export const config = {
  // API-Key wurde aus Sicherheitsgründen entfernt
  // Verwende stattdessen den Cloudflare Worker Proxy: /api/gemini
  model: 'gemini-2.5-flash-preview-09-2025',
  proxyEndpoint: '/api/gemini',

  // Warnung für Entwickler
  getGeminiApiKey: () => {
    throw new Error(
      'SECURITY: Direct API key access removed. Use /api/gemini proxy endpoint instead. ' +
        'Set GEMINI_API_KEY in Cloudflare Worker: wrangler secret put GEMINI_API_KEY',
    );
  },
};
