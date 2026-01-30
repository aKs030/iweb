/**
 * AI API Configuration (using Groq - Free!)
 *
 * SECURITY: API key is stored securely in Cloudflare Worker
 * All client requests use the /api/gemini proxy endpoint
 * (Endpoint name kept for backward compatibility, but uses Groq now)
 *
 * Setup:
 * - Get free key: https://console.groq.com/keys
 * - Set API key: wrangler secret put GROQ_API_KEY
 * - Configure in: wrangler.toml
 */
export const config = {
  model: 'llama-3.3-70b-versatile', // Groq model (free, fast!)
  proxyEndpoint: '/api/gemini', // Kept for backward compatibility
};
