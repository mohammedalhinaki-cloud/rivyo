import { useState } from "react";
import { deleteDownload, downloadSurah, isDownloadSupported } from "../lib/downloads";
import { useDownloads } from "../lib/hooks";
import { AlertIcon, CheckIcon, DownloadIcon, TrashIcon } from "./Icons";

interface DownloadButtonProps {
  surah: number;
  variant?: "icon" | "text";
}

/**
 * زر تنزيل/حذف سورة للاستماع دون إنترنت.
 * - يعرض نسبة التقدّم أثناء التنزيل.
 * - عند اكتمال التنزيل يتحوّل إلى زر حذف مع طلب تأكيد بضغطة ثانية.
 */
export function DownloadButton({ surah, variant = "icon" }: DownloadButtonProps) {
  const downloads = useDownloads();
  const record = downloads[String(surah)];
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const supported = isDownloadSupported();

  const start = async () => {
    setError(null);
    setProgress(0);
    try {
      await downloadSurah(surah, (received, total) => {
        setProgress(total > 0 ? Math.min(99, Math.round((received / total) * 100)) : null);
      });
      setProgress(null);
      setConfirmDelete(false);
    } catch (downloadError) {
      setProgress(null);
      setError(downloadError instanceof Error ? downloadError.message : "تعذّر التنزيل");
    }
  };

  const remove = async () => {
    setError(null);
    await deleteDownload(surah);
    setConfirmDelete(false);
  };

  const label = record ? "محذوف؟ اضغط للتأكيد" : "تنزيل للاستماع دون إنترنت";
  const isBusy = progress != null;

  const onClick = () => {
    if (isBusy) return;
    if (!record) {
      if (!supported) {
        setError("التنزيل متاح داخل تطبيق أندرويد فقط");
        return;
      }
      void start();
      return;
    }
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    void remove();
  };

  const icon = isBusy ? (
    <span className="ring" style={{ ["--progress" as string]: `${progress ?? 0}` }}>
      <span className="ring__label">{progress ?? 0}</span>
    </span>
  ) : record ? (
    confirmDelete ? (
      <AlertIcon width={20} height={20} />
    ) : (
      <TrashIcon width={20} height={20} />
    )
  ) : (
    <DownloadIcon width={20} height={20} />
  );

  return (
    <span className="download-control">
      <button
        type="button"
        className={`icon-button${record ? " icon-button--danger" : ""}${confirmDelete ? " is-armed" : ""}`}
        onClick={onClick}
        aria-label={record ? "حذف التنزيل" : "تنزيل السورة"}
        title={record ? (confirmDelete ? "تأكيد الحذف" : "سورة محمّلة — اضغط للحذف") : "تنزيل للاستماع دون إنترنت"}
      >
        {icon}
      </button>
      {variant === "text" && <span className="muted small">{label}</span>}
      {error && (
        <span className="inline-hint inline-hint--error" role="status">
          <AlertIcon width={14} height={14} /> {error}
        </span>
      )}
      {record && !error && confirmDelete && (
        <span className="inline-hint" role="status">
          <CheckIcon width={14} height={14} /> اضغط مرة أخرى للتأكيد
        </span>
      )}
    </span>
  );
}
