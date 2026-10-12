/**
 * اختبارات وحدة لمنطق التوقيتات (منطق نقي بلا متصفح).
 * التشغيل: npm test   (node --test مع دعم TypeScript الأصلي في Node 22+)
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ayahAtTime, clamp, estimateTimings, previousAyahTarget, timingForAyah } from "../src/lib/player-math.ts";
import type { AyahTiming } from "../src/lib/types.ts";

/** توقيتات شبيهة باستجابة mp3quran الرسمية (مللي ثانية). */
const TIMINGS: AyahTiming[] = [
  { ayah: 1, start: 0, end: 5000 },
  { ayah: 2, start: 5000, end: 12000 },
  { ayah: 3, start: 12000, end: 20000 },
  { ayah: 4, start: 20000, end: 26000 },
];

test("ayahAtTime يعيد الآية الصحيحة داخل كل مقطع", () => {
  assert.equal(ayahAtTime(TIMINGS, 0), 1);
  assert.equal(ayahAtTime(TIMINGS, 2500), 1);
  assert.equal(ayahAtTime(TIMINGS, 5000), 2);
  assert.equal(ayahAtTime(TIMINGS, 11999), 2);
  assert.equal(ayahAtTime(TIMINGS, 12000), 3);
  assert.equal(ayahAtTime(TIMINGS, 25999), 4);
});

test("ayahAtTime في الفواصل وبعد النهاية يعيد أقرب آية", () => {
  const gap: AyahTiming[] = [
    { ayah: 1, start: 0, end: 5000 },
    { ayah: 2, start: 5400, end: 9000 },
  ];
  assert.equal(ayahAtTime(gap, 5200), 1, "الوقت داخل الفاصل يعود للآية السابقة");
  assert.equal(ayahAtTime(gap, 9000), 2, "بعد نهاية آخر آية يبقى على الآية الأخيرة");
  assert.equal(ayahAtTime(gap, 60000), 2);
  assert.equal(ayahAtTime(null, 1000), null, "بلا توقيتات لا يوجد رقم آية");
  assert.equal(ayahAtTime([], 1000), null);
});

test("timingForAyah يجلب التوقيت المطلوب فقط", () => {
  assert.equal(timingForAyah(TIMINGS, 3)?.start, 12000);
  assert.equal(timingForAyah(TIMINGS, 99), null);
  assert.equal(timingForAyah(null, 1), null);
});

test("previousAyahTarget: يبدأ من بداية الآية الحالية ثم ينتقل للتي قبلها", () => {
  // بعد ثانيتين وثلاثة أعشار داخل الآية الثالثة → العودة لبدايتها
  assert.equal(previousAyahTarget(TIMINGS, 14300), 12000);
  // قبل مرور ثانيتين → الانتقال للآية السابقة
  assert.equal(previousAyahTarget(TIMINGS, 13000), 5000);
  // في الآية الأولى → البداية
  assert.equal(previousAyahTarget(TIMINGS, 1500), 0);
  assert.equal(previousAyahTarget(null, 5000), null);
});

test("estimateTimings: تغطية كاملة للزمن وترتيب تصاعدي ونسبية لأطوال الآيات", () => {
  const texts = ["قصير", "نصٌّ أطول بكثير من الذي قبله بكثير جدًا وبكثير من الكلمات", "متوسط الطول هنا"];
  const durationMs = 60_000;
  const estimated = estimateTimings(texts, durationMs);

  assert.equal(estimated.length, 3);
  assert.equal(estimated[0].start, 0);
  assert.equal(estimated[estimated.length - 1].end, durationMs, "النهاية تطابق مدة الملف");

  for (let index = 1; index < estimated.length; index += 1) {
    assert.ok(estimated[index].start >= estimated[index - 1].start, "البدايات تصاعدية");
    assert.ok(estimated[index].end > estimated[index].start, "كل آية لها مدة موجبة");
  }

  const first = estimated[0].end - estimated[0].start;
  const second = estimated[1].end - estimated[1].start;
  assert.ok(second > first, "الآية الأطول تأخذ زمنًا أكبر");
  assert.equal(estimated.map((timing) => timing.ayah).join(","), "1,2,3");
});

test("estimateTimings: حالات حدّية", () => {
  assert.deepEqual(estimateTimings([], 1000), []);
  assert.deepEqual(estimateTimings(["آية"], 0), []);
  const single = estimateTimings(["آية واحدة فقط"], 10_000);
  assert.equal(single.length, 1);
  assert.equal(single[0].start, 0);
  assert.equal(single[0].end, 10_000);
});

test("clamp يحصر القيم داخل المدى", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(42, 0, 10), 10);
  assert.equal(clamp(Number.NaN, 2, 10), 2);
});
