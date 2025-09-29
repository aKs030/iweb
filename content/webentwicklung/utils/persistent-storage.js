/**
 * Fordert (best effort) persistenten Storage an und liefert Status + Quota Estimate zurück.
 * Nutzt die moderne navigator.storage API mit Feature Detection.
 * Fällt still auf "unbekannt" zurück falls nicht unterstützt oder Fehlermeldung.
 * Aufruf ist idempotent: Mehrfache Aufrufe returnen gecachten Promise.
 */
let _persistPromise = null;
export async function ensurePersistentStorage() {
  if (_persistPromise) return _persistPromise;
  _persistPromise = (async () => {
    if (!('storage' in navigator)) {
      return { supported: false, persisted: false };
    }
    const storage = navigator.storage;
    let persisted = false;
    try {
      if ('persisted' in storage) {
        persisted = await storage.persisted().catch(() => false);
      }
      if (!persisted && 'persist' in storage) {
        persisted = await storage.persist().catch(() => false);
      }
      let quota = null;
      if ('estimate' in storage) {
        const est = await storage.estimate().catch(() => null);
        if (est) {
          quota = {
            quota: est.quota,
            usage: est.usage,
            usageDetails: est.usageDetails || undefined
          };
        }
      }
      return { supported: true, persisted, quota };
    } catch {
      return { supported: false, persisted: false };
    }
  })();
  return _persistPromise;
}

// Optional: Auto-Aufruf nach kurzer Verzögerung (nicht-blockierend)
export function schedulePersistentStorageRequest(delay = 2500) {
  try {
    setTimeout(() => { ensurePersistentStorage().catch(() => {}); }, delay);
  } catch { /* ignore */ }
}
