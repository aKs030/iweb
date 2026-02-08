/**
 * Request Validation
 */

/**
 * Validiert Search Request
 */
export function validateSearchRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const { query, topK } = body;

  // Query validieren
  if (!query || typeof query !== 'string') {
    return {
      valid: false,
      error: 'Query ist erforderlich und muss ein String sein',
    };
  }

  if (query.trim().length === 0) {
    return { valid: false, error: 'Query darf nicht leer sein' };
  }

  if (query.length > 500) {
    return { valid: false, error: 'Query ist zu lang (max 500 Zeichen)' };
  }

  // topK validieren (optional)
  if (topK !== undefined) {
    const k = parseInt(topK, 10);
    if (isNaN(k) || k < 1 || k > 50) {
      return { valid: false, error: 'topK muss zwischen 1 und 50 liegen' };
    }
  }

  return { valid: true };
}

/**
 * Validiert AI Request
 */
export function validateAIRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const { prompt, systemInstruction, options } = body;

  // Prompt validieren
  if (!prompt || typeof prompt !== 'string') {
    return {
      valid: false,
      error: 'Prompt ist erforderlich und muss ein String sein',
    };
  }

  if (prompt.trim().length === 0) {
    return { valid: false, error: 'Prompt darf nicht leer sein' };
  }

  if (prompt.length > 10000) {
    return { valid: false, error: 'Prompt ist zu lang (max 10000 Zeichen)' };
  }

  // System Instruction validieren (optional)
  if (
    systemInstruction !== undefined &&
    typeof systemInstruction !== 'string'
  ) {
    return { valid: false, error: 'systemInstruction muss ein String sein' };
  }

  // Options validieren (optional)
  if (options !== undefined && typeof options !== 'object') {
    return { valid: false, error: 'options muss ein Objekt sein' };
  }

  return { valid: true };
}
