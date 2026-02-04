/**
 * Request Validation Utilities
 * Validates incoming API requests
 */

/**
 * Validates search request body
 */
export function validateSearchRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  if (!body.query || typeof body.query !== 'string') {
    return { valid: false, error: 'Missing or invalid query parameter' };
  }

  if (body.query.trim().length === 0) {
    return { valid: false, error: 'Query cannot be empty' };
  }

  if (body.query.length > 500) {
    return { valid: false, error: 'Query too long (max 500 characters)' };
  }

  if (body.topK !== undefined) {
    const topK = parseInt(body.topK, 10);
    if (isNaN(topK) || topK < 1 || topK > 50) {
      return { valid: false, error: 'topK must be between 1 and 50' };
    }
  }

  return { valid: true };
}

/**
 * Validates AI request body
 */
export function validateAIRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  if (!body.prompt || typeof body.prompt !== 'string') {
    return { valid: false, error: 'Missing or invalid prompt parameter' };
  }

  if (body.prompt.trim().length === 0) {
    return { valid: false, error: 'Prompt cannot be empty' };
  }

  if (body.prompt.length > 10000) {
    return { valid: false, error: 'Prompt too long (max 10000 characters)' };
  }

  if (body.systemInstruction && typeof body.systemInstruction !== 'string') {
    return { valid: false, error: 'Invalid systemInstruction parameter' };
  }

  return { valid: true };
}
