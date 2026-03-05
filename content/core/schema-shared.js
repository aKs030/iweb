export function normalizeSchemaText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function uniqueSchemaList(values) {
  const result = [];
  const seen = new Set();

  for (const raw of values || []) {
    const value = normalizeSchemaText(raw);
    if (!value) continue;

    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }

  return result;
}
