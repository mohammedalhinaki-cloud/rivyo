#!/usr/bin/env node
/**
 * اختبار عرض (Smoke test) للشاشتين في بيئة Node بلا متصفح:
 * يبني مدخل scripts/ssr-entry.tsx بـ Vite (SSR) ثم يرسم الشاشات ويتحقق من المحتوى.
 *
 * التشغيل: npm run smoke
 */
import { readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "node_modules", ".smoke");

rmSync(outDir, { recursive: true, force: true });

await build({
  root,
  configFile: false,
  logLevel: "warn",
  build: {
    ssr: join(root, "scripts", "ssr-entry.tsx"),
    outDir,
    emptyOutDir: true,
    minify: false,
    rollupOptions: { external: ["react", "react-dom", "react-dom/server"] },
  },
});

const bundle = readdirSync(outDir).find((file) => file.endsWith(".js"));
if (!bundle) throw new Error("لم يُنتج أي ملف من بناء اختبار العرض");
const mod = await import(pathToFileURL(join(outDir, bundle)).href);

const checks = [];
const expect = (name, condition) => checks.push({ name, ok: Boolean(condition) });

const home = mod.renderHome({
  surah: 18,
  ayah: 50,
  positionMs: 754_000,
  durationMs: 1_500_000,
  updatedAt: Date.now() - 120_000,
});
expect("الرئيسية تُرسم", home.length > 1000);
expect("عنوان التطبيق يظهر", home.includes("المصحف المرتل"));
expect("اسم الشيخ يظهر", home.includes("محمد برهجي"));
expect("قائمة السور تعرض الفاتحة", home.includes("سورة الفاتحة"));
expect("قائمة السور تعرض الناس", home.includes("سورة الناس"));
expect("بطاقة متابعة الاستماع تظهر", home.includes("متابعة الاستماع"));
expect("رقم الآية المحفوظة يظهر", home.includes("الآية 50"));
expect("زر المتابعة من الثانية نفسها", home.includes("متابعة من الثانية نفسها"));
expect("تصنيف مكية يظهر", home.includes("مكية"));
expect("عدّاد الآيات 6236 موجود", home.includes("6236"));

const homePlaying = mod.renderHomeNowPlaying();
expect("المشغّل المصغّر يظهر أثناء التشغيل", homePlaying.includes("mini-player"));
expect("المشغّل المصغّر يعرض السورة الحالية", homePlaying.includes("سورة الكهف"));

const player = mod.renderPlayer();
expect("شاشة المشغّل تُرسم", player.length > 1000);
expect("اسم السورة يظهر", player.includes("سورة البقرة"));
expect("رقم الآية الحالية يظهر", player.includes("الآية 255"));
expect("زر الانتقال إلى آية موجود", player.includes("تشغيل من هنا"));
expect("مدة الملف منسّقة", player.includes("2:00:00"));
expect("الموضع الحالي منسّق", player.includes("1:03"));

const estimated = mod.renderPlayer({ timingSource: "estimated", surah: 9 }, 9);
expect("تنبيه التوقيتات التقديرية يظهر", estimated.includes("تقديري"));

const failing = mod.renderPlayer({ error: "تعذّر تشغيل التلاوة", timingSource: null }, 3);
expect("رسالة الخطأ تظهر", failing.includes("تعذّر تشغيل التلاوة"));

const notice = mod.renderPlayer({ notice: "انتهت سورة البقرة" }, 2);
expect("إشعار الانتقال يظهر", notice.includes("انتهت سورة البقرة"));

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? "✓" : "✗"} ${check.name}`);
}
console.log(`\n${checks.length - failed.length}/${checks.length} تحقق ناجح`);
if (failed.length > 0) {
  console.error("\nفشلت التحققات التالية:", failed.map((check) => check.name).join(" | "));
  process.exit(1);
}
