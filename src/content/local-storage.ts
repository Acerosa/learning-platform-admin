export type PersistStorageResult =
  | { ok: true }
  | { ok: false; quotaExceeded: boolean; error: Error };

export const STORAGE_QUOTA_WARNING =
  "Published curriculum loaded, but the local browser draft cache is full. Your platform content is unaffected.";

export const STORAGE_CACHE_WARNING =
  "Your work is loaded in this session, but the local browser draft cache could not be updated.";

export function isStorageQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const dom = error as DOMException;
  return dom.name === "QuotaExceededError"
    || dom.code === 22
    || dom.code === 1014
    || /quota|exceeded the quota/i.test(error.message);
}

export function writeLocalStorageItem(key: string, value: string): PersistStorageResult {
  if (typeof window === "undefined") return { ok: true };
  try {
    window.localStorage.setItem(key, value);
    return { ok: true };
  } catch (error) {
    if (!isStorageQuotaError(error)) {
      return {
        ok: false,
        quotaExceeded: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
    try {
      window.localStorage.removeItem(key);
      window.localStorage.setItem(key, value);
      return { ok: true };
    } catch (retryError) {
      return {
        ok: false,
        quotaExceeded: true,
        error: retryError instanceof Error ? retryError : new Error(String(retryError)),
      };
    }
  }
}
