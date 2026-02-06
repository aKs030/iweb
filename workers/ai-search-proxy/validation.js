/**
 * Request Validation
 */

const fail = (error) => ({ valid: false, error });
const ok = { valid: true };

function validateString(value, name, maxLen) {
  if (!value || typeof value !== 'string') return fail(`Missing or invalid ${name}`);
  if (!value.trim()) return fail(`${name} cannot be empty`);
  if (value.length > maxLen) return fail(`${name} too long (max ${maxLen} chars)`);
  return null;
}

export function validateSearchRequest(body) {
  if (!body || typeof body !== 'object') return fail('Invalid request body');
  const err = validateString(body.query, 'query', 500);
  if (err) return err;
  if (body.topK !== undefined) {
    const topK = parseInt(body.topK, 10);
    if (isNaN(topK) || topK < 1 || topK > 50) return fail('topK must be between 1 and 50');
  }
  return ok;
}

export function validateAIRequest(body) {
  if (!body || typeof body !== 'object') return fail('Invalid request body');
  const err = validateString(body.prompt, 'prompt', 10000);
  if (err) return err;
  if (body.systemInstruction && typeof body.systemInstruction !== 'string') {
    return fail('Invalid systemInstruction');
  }
  return ok;
}
