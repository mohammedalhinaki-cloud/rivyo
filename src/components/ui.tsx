"use client";

import { useState } from "react";

function safeJson(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch (e) {
    return String(data);
  }
}

/** عرض JSON الخام من Google كما هو — قابل للطي */
export function RawJson({ data, label = "الاستجابة الخام من Google" }: { data: unknown; label?: string }) {
  const text = safeJson(data);

  return (
    <details className="mt-2 rounded-xl border border-black/10 bg-gray-950 text-gray-100">
      <summary className="cursor-pointer select-none px-4 py-2 text-xs font-bold text-gray-300">
        {label} (اضغط للعرض)
      </summary>
      <pre dir="ltr" className="max-h-96 overflow-auto px-4 pb-4 text-left text-[11px] leading-relaxed text-emerald-200">
        {text}
      </pre>
    </details>
  );
}

/** صورة العميل مع بديل عند فشل التحميل */
export function AvatarImg({ src, name, size = 44 }: { src?: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-800"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        aria-hidden
      >
        {name.trim().charAt(0) || "؟"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}
