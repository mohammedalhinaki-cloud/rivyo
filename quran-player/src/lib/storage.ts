/**
 * التخزين المحلي: آخر موضع استماع، الإعدادات، توقيتات السور، والسور المحمّلة.
 * كل الدوال آمنة ضد غياب localStorage (وضع التصفح الخاص) ولا تُسقط التطبيق.
 */
import type { AppSettings, AyahTiming, DownloadRecord, LastPosition } from "./types";

// إعادة التصدير لتسهيل الاستيراد من هذا الملف مباشرة
export type { AppSettings, AyahTiming, DownloadRecord, LastPosition };

const KEYS = {
  lastPosition: "quran.burhaji.lastPosition.v1",
  perSurah: "quran.burhaji.perSurah.v1",
  settings: "quran.burhaji.settings.v1",
  timings: "quran.burhaji.timings.v1",
  downloads: "quran.burhaji.downloads.v1",
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
  speed: 1,
  repeatSurah: false,
  repeatAyah: 0,
  autoNextSurah: true,
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    /* الذاكرة ممتلئة أو التخزين معطّل — نتجاهل بهدوء */
  }
}

/* ------------------------------- آخر موضع ------------------------------- */

function isValidPosition(value: unknown): value is LastPosition {
  if (!value || typeof value !== "object") return false;
  const candidate = value as LastPosition;
  return (
    Number.isInteger(candidate.surah) &&
    candidate.surah >= 1 &&
    candidate.surah <= 114 &&
    Number.isInteger(candidate.ayah) &&
    candidate.ayah >= 1 &&
    Number.isFinite(candidate.positionMs) &&
    candidate.positionMs >= 0
  );
}

export function loadLastPosition(): LastPosition | null {
  const value = readJson<unknown>(KEYS.lastPosition, null);
  return isValidPosition(value) ? value : null;
}

export function saveLastPosition(position: LastPosition): void {
  writeJson(KEYS.lastPosition, position);
  savePerSurahPosition(position);
}

export function clearLastPosition(): void {
  try {
    globalThis.localStorage?.removeItem(KEYS.lastPosition);
  } catch {
    /* تجاهل */
  }
}

/* --------------------------- موضع كل سورة على حدة --------------------------- */

type PerSurahMap = Record<string, LastPosition>;

export function loadPerSurahPosition(surah: number): LastPosition | null {
  const map = readJson<PerSurahMap>(KEYS.perSurah, {});
  const value = map[String(surah)];
  return isValidPosition(value) ? value : null;
}

export function savePerSurahPosition(position: LastPosition): void {
  const map = readJson<PerSurahMap>(KEYS.perSurah, {});
  map[String(position.surah)] = position;
  writeJson(KEYS.perSurah, map);
}

export function clearAllPositions(): void {
  for (const key of [KEYS.lastPosition, KEYS.perSurah]) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* تجاهل */
    }
  }
}

/* -------------------------------- الإعدادات -------------------------------- */

export function loadSettings(): AppSettings {
  const stored = readJson<Partial<AppSettings>>(KEYS.settings, {});
  return {
    speed: typeof stored.speed === "number" && stored.speed > 0.25 && stored.speed <= 2 ? stored.speed : DEFAULT_SETTINGS.speed,
    repeatSurah: Boolean(stored.repeatSurah),
    repeatAyah: typeof stored.repeatAyah === "number" && stored.repeatAyah >= 0 && stored.repeatAyah <= 10 ? stored.repeatAyah : 0,
    autoNextSurah: stored.autoNextSurah !== false,
  };
}

export function saveSettings(settings: AppSettings): void {
  writeJson(KEYS.settings, settings);
}

/* --------------------------------- التوقيتات --------------------------------- */

interface CachedTimings {
  read: string;
  fetchedAt: number;
  timings: AyahTiming[];
}

export function loadCachedTimings(surah: number): AyahTiming[] | null {
  const store = readJson<Record<string, CachedTimings>>(KEYS.timings, {});
  const entry = store[String(surah)];
  if (!entry || !Array.isArray(entry.timings) || entry.timings.length === 0) return null;
  return entry.timings;
}

export function saveCachedTimings(surah: number, timings: AyahTiming[], read: string): void {
  const store = readJson<Record<string, CachedTimings>>(KEYS.timings, {});
  store[String(surah)] = { read, fetchedAt: Date.now(), timings };
  writeJson(KEYS.timings, store);
}

/* -------------------------------- التنزيلات -------------------------------- */

type DownloadMap = Record<string, DownloadRecord>;

export function loadDownloads(): DownloadMap {
  return readJson<DownloadMap>(KEYS.downloads, {});
}

export function saveDownloads(map: DownloadMap): void {
  writeJson(KEYS.downloads, map);
}

export const STORAGE_KEYS = KEYS;
