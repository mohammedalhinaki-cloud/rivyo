/** تخزين مؤقت بسيط داخل localStorage مع مدة صلاحية. */

interface CacheEntry<T> {
  savedAt: number;
  value: T;
}

export function loadCacheValue<T>(key: string, ttlMs: number): T | null {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (!entry || typeof entry.savedAt !== "number") return null;
    if (ttlMs > 0 && Date.now() - entry.savedAt > ttlMs) return null;
    return entry.value;
  } catch {
    return null;
  }
}

export function saveCacheValue<T>(key: string, value: T): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify({ savedAt: Date.now(), value } satisfies CacheEntry<T>));
  } catch {
    /* تجاهل */
  }
}

export function clearCacheValue(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    /* تجاهل */
  }
}
