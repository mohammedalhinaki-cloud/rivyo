/**
 * تنزيل السور للاستماع دون إنترنت (داخل تطبيق أندرويد المُثبَّت فقط).
 *
 * يستخدم Filesystem.downloadFile من Capacitor (تنزيل أصلي مع أحداث تقدّم)،
 * ويحفظ الملف في مساحة بيانات التطبيق الخاصة، ثم يُشغَّل عبر Capacitor.convertFileSrc.
 */
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { RECITER, audioUrlFromServer } from "./audio-sources";
import { loadDownloads, saveDownloads } from "./storage";
import type { DownloadRecord } from "./types";

const FOLDER = "quran-audio";

export type ProgressHandler = (receivedBytes: number, totalBytes: number) => void;

type DownloadMap = Record<string, DownloadRecord>;
type Listener = (map: DownloadMap) => void;

const listeners = new Set<Listener>();

/** هل يدعم هذا الجهاز التنزيل (تطبيق أندرويد/آيفون)؟ */
export function isDownloadSupported(): boolean {
  return Capacitor.isNativePlatform();
}

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function getDownloads(): DownloadMap {
  return loadDownloads();
}

function publish(map: DownloadMap): void {
  saveDownloads(map);
  for (const listener of listeners) listener(map);
}

export function subscribeDownloads(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function filePath(surah: number): string {
  return `${FOLDER}/${String(surah).padStart(3, "0")}.mp3`;
}

/** رابط قابل للتشغيل في عنصر <audio> للنسخة المحمّلة، أو null. */
export function getLocalAudioUrl(surah: number): string | null {
  if (!Capacitor.isNativePlatform()) return null;
  const record = loadDownloads()[String(surah)];
  if (!record?.uri) return null;
  try {
    return Capacitor.convertFileSrc(record.uri);
  } catch {
    return null;
  }
}

export function isDownloaded(surah: number): boolean {
  return Boolean(loadDownloads()[String(surah)]);
}

export function totalDownloadedBytes(): number {
  return Object.values(loadDownloads()).reduce((sum, record) => sum + (record.sizeBytes || 0), 0);
}

/**
 * ينزّل السورة كاملة ويحفظها داخل التطبيق، مع تقرير التقدّم.
 * يرمي خطأ عند الفشل (ويُنظّف الملف الجزئي).
 */
export async function downloadSurah(surah: number, onProgress?: ProgressHandler): Promise<DownloadRecord> {
  if (!isDownloadSupported()) {
    throw new Error("التنزيل متاح في تطبيق أندرويد فقط");
  }

  const url = audioUrlFromServer(RECITER.server, surah);
  const path = filePath(surah);
  let lastBytes = 0;
  let listener: { remove: () => Promise<void> } | null = null;

  try {
    if (onProgress) {
      listener = await Filesystem.addListener("progress", (status) => {
        if (status.url !== url) return;
        lastBytes = status.bytes;
        onProgress(status.bytes, status.contentLength);
      });
    }

    await Filesystem.downloadFile({
      url,
      path,
      directory: Directory.Data,
      recursive: true,
      progress: Boolean(onProgress),
    });
  } catch (error) {
    try {
      await Filesystem.deleteFile({ path, directory: Directory.Data });
    } catch {
      /* الملف الجزئي غير موجود أصلًا */
    }
    throw error instanceof Error ? error : new Error("تعذّر تنزيل السورة");
  } finally {
    await listener?.remove();
  }

  const { uri } = await Filesystem.getUri({ path, directory: Directory.Data });
  let sizeBytes = lastBytes;
  if (!sizeBytes) {
    try {
      const stat = await Filesystem.stat({ path, directory: Directory.Data });
      sizeBytes = stat.size;
    } catch {
      sizeBytes = 0;
    }
  }

  const record: DownloadRecord = { surah, uri, sizeBytes, savedAt: Date.now() };
  const map = loadDownloads();
  map[String(surah)] = record;
  publish(map);
  return record;
}

/** يحذف سورة محمّلة. */
export async function deleteDownload(surah: number): Promise<void> {
  if (isDownloadSupported()) {
    try {
      await Filesystem.deleteFile({ path: filePath(surah), directory: Directory.Data });
    } catch {
      /* الملف قد يكون محذوفًا مسبقًا */
    }
  }
  const map = loadDownloads();
  delete map[String(surah)];
  publish(map);
}

/** يحذف كل التنزيلات. */
export async function deleteAllDownloads(): Promise<void> {
  for (const key of Object.keys(loadDownloads())) {
    await deleteDownload(Number(key));
  }
}
