/** تطبيع النص العربي واللاتيني للبحث. */

const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

/** يزيل التشكيل ويوحّد الهمزات والألف المقصورة والتاء المربوطة. */
export function normalizeArabic(input: string): string {
  return input
    .replace(DIACRITICS, "")
    .replace(/[\u0671\u0622\u0623\u0625\u0627]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0624/g, "\u0648")
    .replace(/\u0626/g, "\u064A")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** تطبيع النص اللاتيني: حذف العلامات وتوحيد المسافات. */
export function normalizeLatin(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeQuery(input: string): string {
  return normalizeLatin(normalizeArabic(input));
}
