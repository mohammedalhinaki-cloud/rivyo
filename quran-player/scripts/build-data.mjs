#!/usr/bin/env node
/**
 * توليد بيانات التطبيق (يُشغَّل عند تغيير المصدر فقط — المخرجات مُلتزَمة في Git).
 *
 * المصدر: حزمة `@muslims-community/quran` (نص مشروع تنزيل Tanzil — الرسم العثماني،
 * مع ترقيم الجزء/الحزب وعلامات السجدة). الترخيص: CC-BY 3.0 — انظر ATTRIBUTION.md.
 *
 * المخرجات:
 *   - src/data/surahs.ts            → بيانات السور الـ114 (الاسم، النطق، العدد، مكية/مدنية)
 *   - public/quran-text/NNN.json    → نص كل سورة (آيات + جزء + سجدة + البسملة)
 *
 * الاستخدام: npm run data
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
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
  throw new Error("لم أجد ملف بيانات القرآن داخل @muslims-community/quran");
}

const data = JSON.parse(readFileSync(resolveSource(), "utf8"));

if (!Array.isArray(data.surahs) || data.surahs.length !== 114) {
  throw new Error("بيانات السور غير صحيحة");
}

const textDir = join(root, "public", "quran-text");
rmSync(textDir, { recursive: true, force: true });
mkdirSync(textDir, { recursive: true });

/** إزالة التشكيل للمقارنات فقط. */
const strip = (s) =>
  s
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
    .replace(/[\u0671\u0622\u0623\u0625]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647");

const checks = [
  [1, 1, "بسم الله الرحمن الرحيم"],
  [2, 1, "الم"],
  [2, 255, "الله لا اله الا هو الحي القيوم"],
  [9, 1, "براءه من الله ورسوله"],
  [18, 50, "واذ قلنا للملئكه اسجدوا"],
  [112, 1, "قل هو الله احد"],
  [114, 6, "من الجنه والناس"],
];

const meta = [];
let totalAyahs = 0;
let totalSajdah = 0;

for (const surah of data.surahs) {
  const ayahs = [];
  const juz = [];
  const sajdah = [];
  let bismillah = null;

  surah.ayat.forEach((ayah, index) => {
    if (index === 0 && typeof ayah.bismillah === "string") bismillah = ayah.bismillah;
    ayahs.push(ayah.text);
    juz.push(ayah.juz ?? 1);
    if (ayah.sajdah) sajdah.push(ayah.id);
  });

  if (ayahs.length !== surah.numberOfAyahs) {
    throw new Error(`عدم تطابق عدد الآيات في السورة ${surah.id}: ${ayahs.length} ≠ ${surah.numberOfAyahs}`);
  }

  totalAyahs += ayahs.length;
  totalSajdah += sajdah.length;

  writeFileSync(
    join(textDir, `${String(surah.id).padStart(3, "0")}.json`),
    JSON.stringify({ surah: surah.id, bismillah, ayahs, juz, sajdah }),
    "utf8",
  );

  meta.push({
    number: surah.id,
    name: surah.name,
    transliteration: surah.englishName,
    translation: surah.englishNameTranslation ?? surah.englishName,
    ayahCount: surah.numberOfAyahs,
    place: String(surah.revelationType).toLowerCase() === "medinan" ? "medinan" : "meccan",
    revelationOrder: surah.revelationOrder ?? 0,
    juzStart: juz[0] ?? 1,
    sajdahCount: sajdah.length,
  });
}

if (totalAyahs !== 6236) throw new Error(`مجموع الآيات غير صحيح: ${totalAyahs}`);
if (totalSajdah !== 15) throw new Error(`عدد السجدات غير صحيح: ${totalSajdah}`);

for (const [surahNumber, ayahNumber, expected] of checks) {
  const file = JSON.parse(readFileSync(join(textDir, `${String(surahNumber).padStart(3, "0")}.json`), "utf8"));
  const text = strip(file.ayahs[ayahNumber - 1] ?? "");
  if (!text.includes(expected)) {
    throw new Error(`فشل التحقق: ${surahNumber}:${ayahNumber} لا تحتوي «${expected}» — وجدنا: ${text}`);
  }
}

const ts = `// ملف مُولَّد آليًا بواسطة scripts/build-data.mjs — لا تُحرّره يدويًا.
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
console.log(`✅ تم توليد ${meta.length} سورة و ${totalAyahs} آية و ${totalSajdah} سجدة.`);
