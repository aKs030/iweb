import { createLogger } from '../../content/core/logger.js';

const log = createLogger('ai-agent-image');

/**
 * Analysiert ein übergebenes Bild.
 */
export async function analyzeImage(env, imageData, userPrompt = '', config) {
  if (!env.AI) return 'Bildanalyse nicht verfügbar.';

  try {
    const prompt = userPrompt
      ? `Analysiere dieses Bild im Web-Kontext. Der Nutzer fragt: "${userPrompt}". Antworte auf Deutsch.`
      : 'Analysiere dieses Bild. Beschreibe es und gib Design-Feedback. Antworte auf Deutsch.';

    const result = await env.AI.run(config.imageModel, {
      prompt,
      image: imageData,
    });
    return result?.description || result?.response || 'Keine Analyse erhalten.';
  } catch (error) {
    log.error('LLaVA error:', error);
    return `Bildanalyse fehlgeschlagen: ${error.message}`;
  }
}
