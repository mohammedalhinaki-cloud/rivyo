/**
 * توقيتات الآيات الرسمية من mp3quran (read=340 = مصحف الشيخ محمد برهجي).
 * الملف يعيد: [{ ayah, start_time, end_time, ... }] بالمللي ثانية.
 * عند تعذّر الجلب يعود التطبيق إلى تقدير محلي (انظر player-math.estimateTimings).
 */
import { MP3QURAN_TIMINGS_API, TIMING_READ } from "./audio-sources";
import { loadCachedTimings, saveCachedTimings } from "./storage";
import type { AyahTiming } from "./types";

interface RawTiming {
  ayah: number;
  start_time: number;
  end_time: number;
}

/** سور فشل جلبها في هذه الجلسة — لتفادي تكرار المحاولات. */
const failed = new Set<number>();

export interface OfficialTimingsResult {
  timings: AyahTiming[];
  source: "official" | "cache";
}

function parseTimings(payload: unknown, expectedAyahCount: number): AyahTiming[] {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error("استجابة التوقيتات فارغة");
  }
  const timings: AyahTiming[] = payload
    .map((item) => {
      const raw = item as Partial<RawTiming>;
      const ayah = Number(raw.ayah);
      const start = Number(raw.start_time);
      const end = Number(raw.end_time);
      if (!Number.isFinite(ayah) || !Number.isFinite(start) || !Number.isFinite(end)) {
        throw new Error("عنصر توقيت غير صالح");
      }
      return { ayah: Math.round(ayah), start: Math.round(start), end: Math.round(end) };
    })
    .filter((timing) => timing.ayah >= 1 && timing.end > timing.start)
    .sort((a, b) => a.ayah - b.ayah);

  if (timings.length !== expectedAyahCount) {
    throw new Error(`عدد التوقيتات (${timings.length}) لا يطابق عدد الآيات (${expectedAyahCount})`);
  }
  return timings;
}

/** يعيد التوقيتات من الكاش إن وُجدت. */
export function getCachedTimings(surah: number): AyahTiming[] | null {
  return loadCachedTimings(surah);
}

/** هل فشل جلب هذه السورة سابقًا في هذه الجلسة؟ */
export function hasTimingFailure(surah: number): boolean {
  return failed.has(surah);
}

/**
 * يجلب التوقيتات الرسمية للسورة.
 * يرمي خطأ عند الفشل حتى يعرض المشغّل تنبيه «توقيتات تقديرية».
 */
export async function fetchOfficialTimings(
  surah: number,
  expectedAyahCount: number,
  timeoutMs = 12000,
): Promise<OfficialTimingsResult> {
  const cached = loadCachedTimings(surah);
  if (cached && cached.length === expectedAyahCount) {
    return { timings: cached, source: "cache" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${MP3QURAN_TIMINGS_API}?surah=${surah}&read=${TIMING_READ}`;
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload: unknown = await response.json();
    const timings = parseTimings(payload, expectedAyahCount);
    saveCachedTimings(surah, timings, TIMING_READ);
    failed.delete(surah);
    return { timings, source: "official" };
  } catch (error) {
    failed.add(surah);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function resetTimingFailures(): void {
  failed.clear();
}
