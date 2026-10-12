/**
 * نص القرآن الكريم (رسم عثماني — مشروع تنزيل Tanzil، ترخيص CC-BY 3.0).
 * الملفات مُولَّدة محليًا في public/quran-text وتُقرأ عند الطلب ثم تُخزَّن في الذاكرة.
 */
import { pad3 } from "../data/surahs";

export interface SurahText {
  surah: number;
  bismillah: string | null;
  ayahs: string[];
  juz: number[];
  sajdah: number[];
}

const memory = new Map<number, SurahText>();
const inflight = new Map<number, Promise<SurahText | null>>();

function assetUrl(surah: number): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.endsWith("/") ? base : `${base}/`}quran-text/${pad3(surah)}.json`;
}

/** يعيد نص السورة كاملًا، أو null عند تعذّر القراءة. */
export async function getSurahText(surah: number): Promise<SurahText | null> {
  const cached = memory.get(surah);
  if (cached) return cached;
  const pending = inflight.get(surah);
  if (pending) return pending;

  const request = (async () => {
    try {
      const response = await fetch(assetUrl(surah));
      if (!response.ok) return null;
      const data = (await response.json()) as SurahText;
      if (!data || !Array.isArray(data.ayahs) || data.ayahs.length === 0) return null;
      const normalized: SurahText = {
        surah: data.surah ?? surah,
        bismillah: typeof data.bismillah === "string" ? data.bismillah : null,
        ayahs: data.ayahs,
        juz: Array.isArray(data.juz) ? data.juz : [],
        sajdah: Array.isArray(data.sajdah) ? data.sajdah : [],
      };
      memory.set(surah, normalized);
      return normalized;
    } catch {
      return null;
    } finally {
      inflight.delete(surah);
    }
  })();

  inflight.set(surah, request);
  return request;
}

export function getCachedSurahText(surah: number): SurahText | null {
  return memory.get(surah) ?? null;
}

/** آية واحدة (1-based) أو null. */
export async function getAyahText(surah: number, ayah: number): Promise<string | null> {
  const text = await getSurahText(surah);
  if (!text) return null;
  return text.ayahs[ayah - 1] ?? null;
}
