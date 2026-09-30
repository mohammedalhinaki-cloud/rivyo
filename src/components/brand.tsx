/** شعار MAAOUN الصغير — ربط بصري احترافي دون نسخ واجهة MAAOUN */

export function MaaounBadge() {
  return (
    <a
      href="https://maaoun.com"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-xs font-medium text-brand-800 transition hover:bg-brand-50"
    >
      <span className="inline-block size-1.5 rounded-full bg-brand-500" aria-hidden />
      Powered by MAAOUN
    </a>
  );
}

export function RivyoMark({ className = "size-9" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-[60%]" stroke="currentColor" strokeWidth="2">
        <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.4 0-2.8-.3-4-.9L3 21l1.9-5.5a8.5 8.5 0 1 1 16.1-4Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m8.5 12 2.5 2.5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-black/5 bg-white/60">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 py-8 text-center">
        <div className="flex items-center gap-2 text-sm text-black/50">
          <RivyoMark className="size-6" />
          <span className="font-bold text-black/70">Rivyo</span>
          <span>— ردود ذكية على تقييمات Google</span>
        </div>
        <MaaounBadge />
        <p className="text-xs text-black/40">
          مشروع مستقل يعمل على نطاق MAAOUN الفرعي reviews.maaoun.com — جميع البيانات في بنية مستقلة تمامًا.
        </p>
      </div>
    </footer>
  );
}
