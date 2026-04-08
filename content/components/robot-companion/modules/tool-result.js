import { TOOL_CARD_CONFIG } from './tool-registry.js';

function normalizeDetailValue(value) {
  const text = String(value ?? '').trim();
  return text.length > 72 ? `${text.slice(0, 69)}...` : text;
}

export function createDetail(label, value) {
  const normalized = normalizeDetailValue(value);
  if (!normalized) return null;
  return {
    label: String(label || '').trim(),
    value: normalized,
  };
}

export function buildToolResult(name, args, success, message, overrides = {}) {
  const config = /** @type {{
    icon?: string,
    title?: string,
    accent?: string,
    replayLabel?: string,
  }} */ (TOOL_CARD_CONFIG[name] || {});
  const details = Array.isArray(overrides.details)
    ? overrides.details.filter(
        (detail) => detail?.label && String(detail.value || '').trim(),
      )
    : [];
  const cta =
    success && overrides.cta !== false
      ? overrides.cta ||
        (config.replayLabel
          ? { mode: 'rerun', label: config.replayLabel }
          : null)
      : overrides.cta === false
        ? null
        : overrides.cta || null;

  return {
    success,
    message,
    status: success ? 'success' : 'error',
    icon: overrides.icon || config.icon || '⚡',
    title: overrides.title || config.title || name,
    summary: overrides.summary || message,
    accent:
      overrides.accent || config.accent || (success ? 'utility' : 'error'),
    details,
    cta,
    toolArgs: { ...(args || {}) },
  };
}
