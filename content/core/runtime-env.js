export function isLocalDevHost(hostname = globalThis.location?.hostname || '') {
  const host = String(hostname || '').toLowerCase();
  if (!host) return false;

  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local')
  ) {
    return true;
  }

  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;

  return false;
}

export function isLocalDevRuntime(locationLike = globalThis.location) {
  return isLocalDevHost(locationLike?.hostname || '');
}
