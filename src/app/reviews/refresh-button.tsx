"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      className="btn-secondary min-h-9 px-3 text-sm"
      disabled={busy || pending}
      onClick={() => {
        setBusy(true);
        startTransition(() => {
          router.refresh();
        });
        // مهلة أمان لإعادة تفعيل الزر
        setTimeout(() => setBusy(false), 5000);
      }}
    >
      <svg viewBox="0 0 20 20" className={`size-4 fill-none stroke-current stroke-2 ${busy || pending ? "animate-spin" : ""}`}>
        <path d="M16.5 10a6.5 6.5 0 1 1-1.9-4.6M16.5 2.5v3.3h-3.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      تحديث
    </button>
  );
}
