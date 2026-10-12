#!/usr/bin/env node
/**
 * توليد بيانات التطبيق (يُشغَّل عند تغيير المصدر فقط — المخرجات مُلتزَمة في Git).
 *
 * المصدر: حزمة `@muslims-community/quran` (بيانات مشروع تنزيل Tanzil).
 * نأخذ منها **البيانات الوصفية فقط** (أسماء السور، النطق، عدد الآيات، مكية/مدنية،
 * بداية الجزء، مواضع السجدة) — أما نص المصحف فلا يُضمَّن في التطبيق إطلاقًا
 * (قرار منتج: التطبيق صوت فقط).
 *
 * المخرجات:
 *   - src/data/surahs.ts  → بيانات السور الـ114
 *
 * الاستخدام: npm run data
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** مسار ملف البيانات داخل الحزمة (بعض الحزم تمنع استيراد المسارات الفرعية مباشرة). */
function resolveSource() {
  const candidates = [];
  try {
    candidates.push(join(dirname(require.resolve("@muslims-community/quran")), "quran.json"));
  } catch {
    /* تجاهل */
  }
  candidates.push(join(root, "node_modules", "@muslims-community", "quran", "dist", "quran.json"));
  for (const candidate of candidates) {
    try {
      readFileSync(candidate);
      return candidate;
    } catch {
      /* جرّب التالي */
    }
  }
  throw new Error("لم أجد ملف بيانات السور داخل @muslims-community/quran");
}

const data = JSON.parse(readFileSync(resolveSource(), "utf8"));

if (!Array.isArray(data.surahs) || data.surahs.length !== 114) {
  throw new Error("بيانات السور غير صحيحة");
}

const meta = [];
let totalAyahs = 0;
let totalSajdah = 0;

for (const surah of data.surahs) {
  let juzStart = 1;
  let sajdahCount = 0;

  surah.ayat.forEach((ayah, index) => {
    if (index === 0 && typeof ayah.juz === "number") juzStart = ayah.juz;
    if (ayah.sajdah) sajdahCount += 1;
  });

  if (surah.ayat.length !== surah.numberOfAyahs) {
    throw new Error(`عدم تطابق عدد الآيات في السورة ${surah.id}: ${surah.ayat.length} ≠ ${surah.numberOfAyahs}`);
  }

  totalAyahs += surah.ayat.length;
  totalSajdah += sajdahCount;

  meta.push({
    number: surah.id,
    name: surah.name,
    transliteration: surah.englishName,
    translation: surah.englishNameTranslation ?? surah.englishName,
    ayahCount: surah.numberOfAyahs,
    place: String(surah.revelationType).toLowerCase() === "medinan" ? "medinan" : "meccan",
    revelationOrder: surah.revelationOrder ?? 0,
    juzStart,
    sajdahCount,
  });
}

if (totalAyahs !== 6236) throw new Error(`مجموع الآيات غير صحيح: ${totalAyahs}`);
if (totalSajdah !== 15) throw new Error(`عدد السجدات غير صحيح: ${totalSajdah}`);
if (meta[0].ayahCount !== 7 || meta[1].ayahCount !== 286 || meta[113].ayahCount !== 6) {
  throw new Error("أعداد آيات الفاتحة/البقرة/الناس غير مطابقة للمتوقع");
}

const ts = `// ملف مُولَّد آليًا بواسطة scripts/build-data.mjs — لا تُحرّره يدويًا.
// ملاحظة: البيانات وصفية فقط (بلا نص المصحف) — التطبيق صوت فقط.
import type { SurahMeta } from "../lib/types";

export const SURAHS: SurahMeta[] = ${JSON.stringify(meta, null, 2)} as SurahMeta[];

export const TOTAL_AYAHS = ${totalAyahs};
export const TOTAL_SAJDAHS = ${totalSajdah};

export function getSurah(number: number | null | undefined): SurahMeta | null {
  if (!number || number < 1 || number > 114) return null;
  return SURAHS[number - 1] ?? null;
}

export function pad3(number: number): string {
  return String(number).padStart(3, "0");
}

export function surahLabel(number: number | null | undefined): string {
  const surah = getSurah(number);
  return surah ? \`سورة \${surah.name}\` : "";
}
`;

writeFileSync(join(root, "src", "data", "surahs.ts"), ts, "utf8");
console.log(`✅ تم توليد بيانات ${meta.length} سورة (${totalAyahs} آية، ${totalSajdah} سجدة) — بلا نص المصحف.`);
