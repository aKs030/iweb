import { escapeHtml } from '#core/text-utils.js';
import { sleep } from '#core/async-utils.js';
import { isLocalDevHost } from '#core/runtime-env.js';

export function isFolderEntry(entry) {
  return entry?.kind === 'folder';
}

export function isMemoryProfileEntry(entry) {
  return entry?.kind === 'memory-profile';
}

export function isUserEntry(entry) {
  return entry?.kind === 'user';
}

export function isMappingEntry(entry) {
  return entry?.kind === 'mapping';
}

export function isLocalhostRuntime() {
  return isLocalDevHost();
}

export { escapeHtml };

export function formatDate(value, options) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('de-DE', options);
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString('de-DE');
}

export function truncateText(value, maxLength = 140) {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}...`;
}

export function parseToEpoch(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value || ''));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function normalizePageNumber(value, fallback = 1) {
  const pageNumber = Number(value);
  if (!Number.isFinite(pageNumber)) return fallback;
  return Math.max(1, Math.floor(pageNumber));
}

export function parseRetryAfterSeconds(value) {
  const seconds = Number.parseInt(String(value || ''), 10);
  if (Number.isFinite(seconds) && seconds > 0) return seconds;
  return 0;
}

export { sleep };

export function getLatestDateValue(currentValue, nextValue) {
  return parseToEpoch(nextValue) > parseToEpoch(currentValue)
    ? nextValue
    : currentValue;
}

export function getArrayItems(value) {
  return Array.isArray(value) ? value : [];
}

export function getTrimmedString(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

export function getRawString(value, fallback = '') {
  return String(value || fallback);
}

export function getStringField(item, key, fallback = '') {
  return getTrimmedString(item?.[key], fallback);
}

export function getRawStringField(item, key, fallback = '') {
  return getRawString(item?.[key], fallback);
}

export function getNumberField(item, key) {
  return Number(item?.[key]) || 0;
}

export function getDateField(item, key) {
  return item?.[key] || '';
}

export function getNullableField(item, key, fallback = null) {
  return item?.[key] ?? fallback;
}

export function getFirstDefinedField(item, keys, fallback = '') {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return fallback;
}

export function getAliasedStringField(item, keys, fallback = '') {
  return getTrimmedString(getFirstDefinedField(item, keys), fallback);
}

export function getAliasedDateField(item, keys) {
  return getRawString(getFirstDefinedField(item, keys, ''));
}

export function sortByDateFieldDesc(items, field) {
  return [...items].sort(
    (a, b) => parseToEpoch(b?.[field]) - parseToEpoch(a?.[field]),
  );
}

export function sortByLatestMemoryAtDesc(items) {
  return sortByDateFieldDesc(items, 'latestMemoryAt');
}

export function resolveUserTone(status) {
  return status === 'identified' ? 'success' : 'neutral';
}

export function resolveMappingStatus(status) {
  return String(status || 'linked')
    .trim()
    .toLowerCase();
}

export function resolveMappingTone(status) {
  return status === 'conflict'
    ? 'error'
    : status === 'linked'
      ? 'success'
      : status === 'orphan'
        ? 'warning'
        : 'neutral';
}

export function resolveAuditStatus(status) {
  return String(status || '')
    .trim()
    .toLowerCase();
}

export function resolveAuditTone(status) {
  return status === 'failed' || status === 'error'
    ? 'error'
    : status === 'success' || status === 'ok'
      ? 'success'
      : 'neutral';
}
