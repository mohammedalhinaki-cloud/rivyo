import Link from "next/link";
import { headers } from "next/headers";
import { getAppConfig, envCheckRows } from "@/lib/config";
import { getCurrentUser, isAdminEmail } from "@/lib/auth";
import { baseUrlFromHeaders } from "@/lib/urls";
import { MaaounBadge, RivyoMark } from "@/components/brand";
import { TestClient } from "./test-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "اختبار تكامل Google" };

export default async function GoogleTestPage() {
  const envRows = envCheckRows();
  const cfg = getAppConfig();
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }
  const isAdmin = user ? isAdminEmail(user.email) : false;

  const h = await headers();
  const base = baseUrlFromHeaders(h);
  const redirectUri = `${base}/api/auth/google/callback`;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <RivyoMark />
          <span className="text-xl font-extrabold">Rivyo</span>
        </div>
        <MaaounBadge />
      </div>

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold">اختبار تكامل Google Business Profile API</h1>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 font-mono text-xs text-black/50" dir="ltr">
            /admin/google-test
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-black/60">
          هذه الصفحة تختبر التكامل الحقيقي فقط: لا بيانات تجريبية، ولا محاكاة، ولا تخطٍّ للأخطاء.
          كل نتيجة تأتي من نداء فعلي إلى Google، وكل خطأ يُعرض برسالته الأصلية كما وردت من Google.
        </p>
        <Link href="/" className="mt-2 inline-block text-sm text-brand-700 underline">
          ← العودة للرئيسية
        </Link>
      </div>

      <TestClient
        envRows={envRows}
        redirectUri={redirectUri}
        loggedIn={Boolean(user)}
        userEmail={user?.email ?? null}
        isAdmin={isAdmin}
        configOk={cfg.missingCore.length === 0}
      />
    </main>
  );
}
