import Link from "next/link";
import { RawJson } from "@/components/ui";

/** بطاقة: البيئة غير مهيأة — رسالة صادقة بدون أي تمويه */
export function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <div className="card border-amber-200 bg-amber-50 p-5">
      <h2 className="font-extrabold text-amber-900">البيئة غير مهيأة بعد</h2>
      <p className="mt-1 text-sm text-amber-800">
        متغيرات ناقصة: <span dir="ltr" className="font-mono">{missing.join("، ")}</span>
      </p>
      <p className="mt-2 text-sm text-amber-800">
        راجع <span dir="ltr" className="font-mono">README.md</span> لخطوات الإعداد الكاملة، ثم تحقق من كل شيء في{" "}
        <Link href="/admin/google-test" className="font-bold underline">
          /admin/google-test
        </Link>
        .
      </p>
    </div>
  );
}

/** بطاقة خطأ API مع رسالة Google الأصلية كاملة */
export function ApiErrorCard({
  title,
  message,
  raw,
  docs,
}: {
  title: string;
  message: string;
  raw?: unknown;
  docs?: string;
}) {
  return (
    <div className="card border-red-200 bg-red-50 p-5">
      <h2 className="font-extrabold text-red-900">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-red-800">{message}</p>
      {docs && (
        <a
          href={docs}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs font-bold text-red-700 underline"
        >
          الوثيقة الرسمية من Google
        </a>
      )}
      {raw != null && <RawJson data={raw} label="رسالة الخطأ الأصلية من Google" />}
    </div>
  );
}

/** بطاقة: انقطع الاتصال بـ Google — إعادة الربط */
export function ReconnectCard({ message, raw }: { message: string; raw?: unknown }) {
  return (
    <div className="card border-amber-200 bg-amber-50 p-5">
      <h2 className="font-extrabold text-amber-900">انقطع الاتصال بحساب Google</h2>
      <p className="mt-1 text-sm leading-relaxed text-amber-800">{message}</p>
      {raw != null && <RawJson data={raw} label="تفاصيل الخطأ الأصلية" />}
      <a href="/api/auth/google/start" className="btn-primary mt-4">
        إعادة ربط حساب Google
      </a>
    </div>
  );
}
