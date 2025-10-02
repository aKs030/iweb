/**
 * Persistent Storage - Browser Storage Persistence Management
 *
 * Moderne Storage API Integration:
 * - navigator.storage.persist() für dauerhaften Storage
 * - Feature Detection mit graceful degradation
 * - Quota-Informationen und Status-Reporting
 * - Idempotente Promise-basierte API
 * - Optional: Auto-Aktivierung mit konfigurierbarer Verzögerung
 *
 * @author Portfolio System
 * @version 1.0.0
 * @created 2025-10-02
 */

let _persistPromise = null;
export async function ensurePersistentStorage() {
  if (_persistPromise) return _persistPromise;
  _persistPromise = (async () => {
    if (!("storage" in navigator)) {
      return { supported: false, persisted: false };
    }
    const storage = navigator.storage;
    let persisted = false;
    try {
      if ("persisted" in storage) {
        persisted = await storage.persisted().catch(() => false);
      }
      if (!persisted && "persist" in storage) {
        persisted = await storage.persist().catch(() => false);
      }
      let quota = null;
      if ("estimate" in storage) {
        const est = await storage.estimate().catch(() => null);
        if (est) {
          quota = {
            quota: est.quota,
            usage: est.usage,
            usageDetails: est.usageDetails || undefined,
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
    setTimeout(() => {
      ensurePersistentStorage().catch(() => {});
    }, delay);
  } catch {
    /* ignore */
  }
}
