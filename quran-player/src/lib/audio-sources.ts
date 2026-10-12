/**
 * مصادر التلاوة والشيخ.
 *
 * الحقائق الموثَّقة (تم التحقق منها من بيانات mp3quran ومن مستودعات مفتوحة تستخدم الواجهة نفسها):
 *  - ملفات الشيخ: https://server16.mp3quran.net/M_Burhaji/Rewayat-Hafs-A-n-Assem/NNN.mp3  (NNN بثلاث خانات)
 *  - معرّف المقرئ في mp3quran: 21181 — ومعرّف المصحف (رواية حفص مرتل): 340
 *  - فهرس توقيتات الآيات: https://www.mp3quran.net/api/v3/ayat_timing?surah=N&read=340
 */
import { pad3 } from "../data/surahs";
import { loadCacheValue, saveCacheValue } from "./cache";

export const RECITER = {
  /** معرّف المقرئ في mp3quran */
  reciterId: 21181,
  /** معرّف المصحف/الرواية في mp3quran = قيمة read في واجهة التوقيتات */
  moshafId: 340,
  name: "الشيخ أ.د. محمد برهجي",
  shortName: "محمد برهجي",
  rewaya: "حفص عن عاصم — مرتل",
  /** المجلد الرسمي للملفات */
  server: "https://server16.mp3quran.net/M_Burhaji/Rewayat-Hafs-A-n-Assem",
  sourceName: "mp3quran.net",
} as const;

/** قيمة read في واجهة التوقيتات الرسمية. */
export const TIMING_READ = String(RECITER.moshafId);

export const MP3QURAN_RECITERS_API = "https://www.mp3quran.net/api/v3/reciters";
export const MP3QURAN_TIMINGS_API = "https://www.mp3quran.net/api/v3/ayat_timing";

const SERVER_CACHE_KEY = "quran.burhaji.resolvedServer.v1";
const SERVER_CACHE_TTL = 1000 * 60 * 60 * 24 * 30;

export function surahFileName(surah: number): string {
  return `${pad3(surah)}.mp3`;
}

export function audioUrlFromServer(server: string, surah: number): string {
  return `${server.replace(/\/+$/, "")}/${surahFileName(surah)}`;
}

interface RecitersResponse {
  reciters?: Array<{
    id: number;
    moshaf?: Array<{ id: number; server?: string; surah_total?: number }>;
  }>;
}

/**
 * يجلب مجلد التلاوة من واجهة mp3quran الرسمية (ويُخزّنه 30 يومًا).
 * يُستخدم كمصدر بديل تلقائي إذا فشل المجلد الأساسي.
 */
export async function resolveServerFromApi(): Promise<string | null> {
  const cached = loadCacheValue<{ server: string }>(SERVER_CACHE_KEY, SERVER_CACHE_TTL);
  if (cached?.server) return cached.server;
  try {
    const response = await fetch(`${MP3QURAN_RECITERS_API}?language=ar`);
    if (!response.ok) return null;
    const data = (await response.json()) as RecitersResponse;
    const reciter = data.reciters?.find((item) => item.id === RECITER.reciterId);
    const moshaf = reciter?.moshaf?.find((item) => item.id === RECITER.moshafId);
    const server = moshaf?.server?.trim();
    if (!server) return null;
    saveCacheValue(SERVER_CACHE_KEY, { server });
    return server;
  } catch {
    return null;
  }
}

/**
 * قائمة مصادر الصوت بالترتيب: النسخة المحمّلة (إن وُجدت) ← المجلد الأساسي ← مجلد الواجهة الرسمية.
 * يجعل التشغيل صامدًا أمام تعطّل أحد الخوادم.
 */
export async function resolveAudioSources(surah: number, localUrl: string | null): Promise<string[]> {
  const sources: string[] = [];
  if (localUrl) sources.push(localUrl);
  sources.push(audioUrlFromServer(RECITER.server, surah));
  const fallback = await resolveServerFromApi();
  if (fallback) {
    const url = audioUrlFromServer(fallback, surah);
    if (!sources.includes(url)) sources.push(url);
  }
  return sources;
}
