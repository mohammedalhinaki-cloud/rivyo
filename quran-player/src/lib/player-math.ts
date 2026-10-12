/**
 * منطق رياضي نقي (بلا اعتماد على المتصفح) — قابل للاختبار بوحدة مستقلة.
 * انظر scripts/player-math.test.ts
 */
import type { AyahTiming } from "./types";

/**
 * رقم الآية عند لحظة زمنية معيّنة (بالمللي ثانية).
 * يعيد 1-based، أو `null` إن لم توجد توقيتات.
 */
export function ayahAtTime(timings: AyahTiming[] | null | undefined, timeMs: number): number | null {
  if (!timings || timings.length === 0) return null;
  let low = 0;
  let high = timings.length - 1;
  if (timeMs < timings[0].start) return timings[0].ayah;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const timing = timings[mid];
    if (timeMs < timing.start) {
      high = mid - 1;
    } else if (timeMs >= timing.end) {
      low = mid + 1;
    } else {
      return timing.ayah;
    }
  }
  // وقع بين آيتين (فاصل قصير) → الآية الأقرب السابقة.
  const index = Math.min(Math.max(low, 0), timings.length - 1);
  if (timeMs >= timings[index].start) return timings[index].ayah;
  const previous = Math.max(index - 1, 0);
  return timings[previous].ayah;
}

/** توقيت آية محددة (1-based). */
export function timingForAyah(timings: AyahTiming[] | null | undefined, ayah: number): AyahTiming | null {
  if (!timings) return null;
  return timings.find((timing) => timing.ayah === ayah) ?? null;
}

/**
 * تقدير توقيتات الآيات محليًا عند تعذّر جلب الفهرس الرسمي.
 * التطبيق لا يضمّن نص المصحف (صوت فقط)، لذا التوزيع متساٍ بين الآيات
 * (قسمة مدة الملف على عددها) مع حد أدنى نصف ثانية لكل آية.
 */
export function estimateTimings(ayahCount: number, durationMs: number): AyahTiming[] {
  if (!Number.isInteger(ayahCount) || ayahCount <= 0 || !Number.isFinite(durationMs) || durationMs <= 0) return [];
  const share = durationMs / ayahCount;
  const timings: AyahTiming[] = [];
  for (let index = 0; index < ayahCount; index += 1) {
    const start = Math.round(index * share);
    const end = index === ayahCount - 1 ? Math.round(durationMs) : Math.round((index + 1) * share);
    timings.push({ ayah: index + 1, start, end: Math.max(end, start + 500) });
  }
  return timings;
}

/**
 * الوجهة عند الضغط على «الآية السابقة»:
 * إن مضى أكثر من ثانيتين داخل الآية الحالية نعود لبدايتها، وإلا ننتقل للآية قبلها.
 * (نفس سلوك مشغلات الصوت المعتادة)
 */
export function previousAyahTarget(timings: AyahTiming[] | null | undefined, currentMs: number, thresholdMs = 2000): number | null {
  const current = ayahAtTime(timings, currentMs);
  if (current == null || !timings) return null;
  const timing = timingForAyah(timings, current);
  if (!timing) return timings[0].start;
  if (currentMs - timing.start > thresholdMs) return timing.start;
  const previous = timingForAyah(timings, current - 1);
  return (previous ?? timing).start;
}

/** يحصر قيمة داخل مدى. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}
