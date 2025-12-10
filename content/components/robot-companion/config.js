// Configuration for Robot Companion
// WARNING: Do not commit your real API key to a public repository.
// For local development, you can set it here.
// For production, consider using a backend proxy or environment variables if supported.

// Optional runtime override via `window.robotCompanionConfig = {}`
// Use this to inject API keys locally without committing them to the repo.
const _winCfg = typeof window !== 'undefined' && window.robotCompanionConfig ? window.robotCompanionConfig : {};

export const config = {
  geminiApiKey: _winCfg.geminiApiKey || '', // User can set Google Gemini key here
  model: _winCfg.model || 'gemini-flash-latest',
  apiBaseUrl: _winCfg.apiBaseUrl || 'https://generativelanguage.googleapis.com/v1beta/models',
  // Optional: Hugging Face Inference API token (free tier available)
  huggingFaceApiKey: _winCfg.huggingFaceApiKey || '', // e.g. 'hf_xxx' - set this if you want to use HF as fallback
  huggingFaceModel: _winCfg.huggingFaceModel || 'gpt2', // e.g. 'gpt2' (small, free) or 'bigscience/bloomz' (bigger)
};
