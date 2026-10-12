/** دوال مساعدة للتنسيق والعرض. */

/** يحوّل المللي ثانية إلى mm:ss أو h:mm:ss. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** نص مختصر لآخر موضع: «منذ 5 دقائق». */
export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (!Number.isFinite(diff) || diff < 0) return "الآن";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} ${minutes === 1 ? "دقيقة" : minutes === 2 ? "دقيقتين" : "دقيقة"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ${hours === 1 ? "ساعة" : hours === 2 ? "ساعتين" : "ساعة"}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} ${days === 1 ? "يوم" : days === 2 ? "يومين" : "يوم"}`;
  return new Date(timestamp).toLocaleDateString("ar", { day: "numeric", month: "long" });
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 م.ب";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} ك.ب`;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} م.ب`;
}

export const PLACE_LABEL: Record<"meccan" | "medinan", string> = {
  meccan: "مكية",
  medinan: "مدنية",
};
