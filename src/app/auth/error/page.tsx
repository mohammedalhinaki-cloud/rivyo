import { cookies } from "next/headers";
import { AUTH_ERROR_COOKIE } from "@/lib/session";
import { RawJson } from "@/components/ui";
import { MaaounBadge, RivyoMark } from "@/components/brand";

export const dynamic = "force-dynamic";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const sp = await searchParams;
  const jar = await cookies();
  const raw = jar.get(AUTH_ERROR_COOKIE)?.value;
  let parsed: { message?: string; raw?: unknown; at?: string } | null = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  const message =
    sp.code === "missing_env"
      ? "المشروع غير مهيأ بعد — متغيرات البيئة الأساسية ناقصة. راجع README.md ثم /admin/google-test."
      : (parsed?.message ?? "حدث خطأ غير معروف أثناء تسجيل الدخول عبر Google.");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <RivyoMark />
          <span className="text-xl font-extrabold">Rivyo</span>
        </div>
        <MaaounBadge />
      </div>

      <div className="card border-red-200 bg-red-50 p-6">
        <h1 className="text-xl font-extrabold text-red-900">تعذّر إكمال تسجيل الدخول عبر Google</h1>
        <p className="mt-3 text-sm leading-relaxed text-red-800">{message}</p>
        {parsed?.raw != null && <RawJson data={parsed.raw} label="رسالة الخطأ الأصلية من Google" />}
        <div className="mt-5 flex flex-wrap gap-3">
          <a href="/api/auth/google/start" className="btn-primary">
            إعادة المحاولة
          </a>
          <a href="/" className="btn-secondary">
            العودة للرئيسية
          </a>
          <a href="/admin/google-test" className="btn-secondary">
            صفحة فحص التكامل
          </a>
        </div>
      </div>
    </main>
  );
}
