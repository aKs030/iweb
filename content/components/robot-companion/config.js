/**
 * Gemini API Configuration
 *
 * SECURITY: API key is stored securely in Cloudflare Worker
 * All client requests use the /api/gemini proxy endpoint
 *
 * Setup:
 * - Set API key: wrangler secret put GEMINI_API_KEY
 * - Configure in: wrangler.toml
 */
export const config = {
  model: 'gemini-2.5-flash-preview-09-2025',
  proxyEndpoint: '/api/gemini',
};
