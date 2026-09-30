import Link from "next/link";
import { headers } from "next/headers";
import { getAppConfig } from "@/lib/config";
import { getCurrentUser, isAdminEmail } from "@/lib/auth";
import { baseUrlFromHeaders } from "@/lib/urls";
import { MaaounBadge, RivyoMark, SiteFooter } from "@/components/brand";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cfg = getAppConfig();
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }
  const admin = user ? isAdminEmail(user.email) : false;
  const h = await headers();
  const base = baseUrlFromHeaders(h);
  const redirectUri = `${base}/api/auth/google/callback`;
  const missing = cfg.missingCore;

  return (
    <>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4">
        <header className="flex items-center justify-between py-5">
          <div className="flex items-center gap-2.5">
            <RivyoMark />
            <span className="text-xl font-extrabold tracking-tight">Rivyo</span>
          </div>
          <MaaounBadge />
        </header>

        {/* تنبيه إعداد صادق — يظهر فقط عندما تكون البيئة غير مهيأة */}
        {missing.length > 0 && (
          <div className="card mb-6 border-amber-200 bg-amber-50 p-5">
            <h2 className="font-extrabold text-amber-900">المشروع غير مهيأ بعد — لا توجد بيانات تجريبية لإخفاء ذلك</h2>
            <p className="mt-1 text-sm text-amber-800">
              متغيرات البيئة الناقصة: <span dir="ltr" className="font-mono">{missing.join("، ")}</span>
            </p>
            <p className="mt-2 text-sm text-amber-800">
              اتبع خطوات الإعداد في <span dir="ltr" className="font-mono">README.md</span> ثم تحقق من الحالة عبر صفحة
              {" "}
              <Link href="/admin/google-test" className="font-bold underline">
                /admin/google-test
              </Link>
              .
            </p>
            <p className="mt-2 text-xs text-amber-700">
              Redirect URI المطلوب تسجيله في Google Cloud Console:{" "}
              <span dir="ltr" className="break-all font-mono">{redirectUri}</span>
            </p>
          </div>
        )}

        {/* البطل */}
        <section className="pt-8 pb-10 text-center sm:pt-14">
          <h1 className="mx-auto max-w-xl text-3xl leading-tight font-extrabold sm:text-4xl">
            رد على تقييمات Google تلقائيًا بالذكاء الاصطناعي
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base text-black/60">
            اربط نشاطك التجاري، واقرأ تقييمات عملائك الحقيقية، واحصل على رد عربي طبيعي جاهز لكل تقييم —
            لا يُنشر أي رد إلا بعد موافقتك.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            {user ? (
              <>
                <Link href="/reviews" className="btn-primary w-full max-w-xs">
                  متابعة إلى التقييمات
                </Link>
                {admin && (
                  <Link href="/admin/google-test" className="text-sm text-brand-700 underline">
                    صفحة اختبار تكامل Google
                  </Link>
                )}
              </>
            ) : (
              <a href="/api/auth/google/start" className="btn-primary w-full max-w-xs">
                اربط حساب Google
              </a>
            )}
            <p className="text-xs text-black/45">
              تسجيل دخول آمن عبر Google الرسمية — لن نطلب كلمة المرور أبدًا
            </p>
          </div>
        </section>

        {/* المزايا */}
        <section className="grid gap-3 pb-10 sm:grid-cols-3">
          {[
            {
              icon: "★",
              title: "تقييماتك في مكان واحد",
              text: "تقييمات Google الحقيقية تظهر لديك مباشرة: الاسم، النجوم، النص، التاريخ، وحالة الرد.",
            },
            {
              icon: "✍",
              title: "ردود عربية جاهزة",
              text: "الذكاء الاصطناعي يقترح ردًا طبيعيًا وقصيرًا لكل تقييم، وتراجعه وتعدله قبل النشر.",
            },
            {
              icon: "✓",
              title: "سيطرتك كاملة",
              text: "الافتراضي هو الرد اليدوي. لا يُنشر أي رد تلقائيًا إلا إذا فعّلت ذلك بنفسك.",
            },
          ].map((f) => (
            <div key={f.title} className="card p-4">
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-brand-50 text-lg text-brand-700">
                {f.icon}
              </span>
              <h3 className="mt-3 font-bold">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-black/60">{f.text}</p>
            </div>
          ))}
        </section>

        {/* كيف يعمل */}
        <section className="pb-12">
          <h2 className="text-center text-lg font-extrabold">كيف يعمل؟</h2>
          <ol className="mx-auto mt-4 grid max-w-2xl gap-3 sm:grid-cols-4">
            {["اربط حساب Google", "اختر نشاطك التجاري", "شاهد التقييمات", "انشر الرد بضغطة"].map((s, i) => (
              <li key={s} className="card p-4 text-center">
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <p className="mt-2 text-sm font-bold">{s}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
