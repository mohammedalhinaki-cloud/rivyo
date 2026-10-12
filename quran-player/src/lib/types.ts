/** أنواع البيانات الأساسية للتطبيق. */

export type Place = "meccan" | "medinan";

export interface SurahMeta {
  number: number;
  /** الاسم بالعربية: الفاتحة، البقرة، ... */
  name: string;
  /** النطق اللاتيني للبحث: Al-Fatiha */
  transliteration: string;
  /** المعنى بالإنجليزية (للبحث) */
  translation: string;
  ayahCount: number;
  place: Place;
  /** ترتيب النزول */
  revelationOrder: number;
  /** الجزء الذي تبدأ فيه السورة */
  juzStart: number;
  /** عدد آيات السجدة في السورة */
  sajdahCount: number;
}

/** توقيت آية واحدة داخل ملف السورة (بالمللي ثانية). */
export interface AyahTiming {
  /** رقم الآية داخل السورة، يبدأ من 1 */
  ayah: number;
  /** بداية الآية بالمللي ثانية */
  start: number;
  /** نهاية الآية بالمللي ثانية */
  end: number;
}

/**
 * مصدر التوقيتات:
 *  - official: من واجهة mp3quran الرسمية (read=340 = مصحف الشيخ برهجي)
 *  - estimated: تقدير محلي مبني على أطوال الآيات (يظهر تنبيه صريح للمستخدم)
 */
export type TimingSource = "official" | "estimated";

/** آخر موضع استماع محفوظ. */
export interface LastPosition {
  surah: number;
  ayah: number;
  positionMs: number;
  durationMs: number;
  updatedAt: number;
}

export interface AppSettings {
  speed: number;
  repeatSurah: boolean;
  /** عدد مرات إعادة الآية الإضافية (0 = دون إعادة) */
  repeatAyah: number;
  autoNextSurah: boolean;
}

export interface DownloadRecord {
  surah: number;
  uri: string;
  sizeBytes: number;
  savedAt: number;
}
