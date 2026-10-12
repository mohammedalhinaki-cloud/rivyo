/** hooks مشتركة واجهة المستخدم. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { SURAHS } from "../data/surahs";
import { getDownloads, subscribeDownloads } from "./downloads";
import { normalizeQuery } from "./normalize";
import { loadCacheValue, saveCacheValue } from "./cache";
import type { DownloadRecord, SurahMeta } from "./types";

export type SurahFilter = "all" | "meccan" | "medinan" | "downloaded";

/** تنزيلات المستخدم مع تحديث تلقائي عند أي تغيير. */
export function useDownloads(): Record<string, DownloadRecord> {
  const [map, setMap] = useState(() => getDownloads());
  useEffect(() => subscribeDownloads(setMap), []);
  return map;
}

/** فلترة السور بالبحث (اسم عربي / نطق لاتيني / رقم) ونوع السورة. */
export function useSurahSearch(query: string, filter: SurahFilter): SurahMeta[] {
  const downloads = useDownloads();
  return useMemo(() => {
    const normalized = normalizeQuery(query);
    const numeric = /^\d+$/.test(query.trim()) ? Number(query.trim()) : null;
    return SURAHS.filter((surah) => {
      if (filter === "meccan" && surah.place !== "meccan") return false;
      if (filter === "medinan" && surah.place !== "medinan") return false;
      if (filter === "downloaded" && !downloads[String(surah.number)]) return false;
      if (!normalized) return true;
      if (numeric != null && surah.number === numeric) return true;
      if (String(surah.number) === normalized) return true;
      return (
        normalizeQuery(surah.name).includes(normalized) ||
        normalizeQuery(surah.transliteration).includes(normalized) ||
        normalizeQuery(surah.translation).includes(normalized)
      );
    });
  }, [query, filter, downloads]);
}

export type Theme = "dark" | "light";

const THEME_KEY = "quran.burhaji.theme.v1";

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => loadCacheValue<Theme>(THEME_KEY, 0) ?? "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#070c10" : "#f4f6f2");
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((previous) => {
      const next: Theme = previous === "dark" ? "light" : "dark";
      saveCacheValue(THEME_KEY, next);
      return next;
    });
  }, []);

  return [theme, toggle];
}
