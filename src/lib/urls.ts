/**
 * تحديد عنوان التطبيق الحالي (لأجل redirect_uri الخاص بـ Google OAuth).
 * في الإنتاج يُستخدم NEXT_PUBLIC_APP_URL (https://reviews.maaoun.com).
 * محليًا يُشتق العنوان من headers حتى يعمل التطوير على أي منفذ/معاينة.
 */
export function baseUrlFromHeaders(h: Headers): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) return appUrl.replace(/\/+$/, "");
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.") || host.startsWith("0.0.0.0");
  const proto = h.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}

export function baseUrlFromRequest(req: Request): string {
  return baseUrlFromHeaders(req.headers);
}
