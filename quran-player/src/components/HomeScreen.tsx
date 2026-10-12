import { memo, useMemo, useState } from "react";
import { SURAHS, getSurah } from "../data/surahs";
import { PLACE_LABEL, formatBytes, formatDuration, formatRelativeTime } from "../lib/format";
import { useDownloads, useSurahSearch, useTheme, type SurahFilter } from "../lib/hooks";
import { isDownloadSupported } from "../lib/downloads";
import { clearLastPosition } from "../lib/storage";
import type { LastPosition } from "../lib/types";
import {
  AlertIcon,
  BookIcon,
  CheckIcon,
  ClockIcon,
  LayersIcon,
  MoonIcon,
  PauseIcon,
  PlayIcon,
  SearchIcon,
  SunIcon,
  XIcon,
} from "./Icons";
import { DownloadButton } from "./DownloadButton";

export interface NowPlayingSummary {
  surah: number;
  ayah: number | null;
  isPlaying: boolean;
}

export interface HomeScreenProps {
  lastPosition: LastPosition | null;
  onResume: () => void;
  onOpenSurah: (surah: number) => void;
  onPlaySurah: (surah: number) => void;
  nowPlaying: NowPlayingSummary | null;
  onTogglePlay: () => void;
}

const FILTERS: Array<{ id: SurahFilter; label: string }> = [
  { id: "all", label: "الكل" },
  { id: "meccan", label: "مكية" },
  { id: "medinan", label: "مدنية" },
  { id: "downloaded", label: "المحمّلة" },
];

interface SurahRowProps {
  surahNumber: number;
  isCurrent: boolean;
  isPlaying: boolean;
  downloaded: boolean;
  onOpen: (surah: number) => void;
  onPlay: (surah: number) => void;
}

const SurahRow = memo(function SurahRow({ surahNumber, isCurrent, isPlaying, downloaded, onOpen, onPlay }: SurahRowProps) {
  const surah = getSurah(surahNumber);
  if (!surah) return null;
  return (
    <li className={`surah-row${isCurrent ? " is-current" : ""}`}>
      <button type="button" className="surah-row__main" onClick={() => onOpen(surah.number)}>
        <span className="surah-row__number">{surah.number}</span>
        <span className="surah-row__names">
          <span className="surah-row__name">سورة {surah.name}</span>
          <span className="surah-row__meta">
            {surah.transliteration} · {surah.ayahCount} آية · {PLACE_LABEL[surah.place]} · الجزء {surah.juzStart}
            {downloaded ? " · محمّلة" : ""}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="icon-button icon-button--soft"
        aria-label={isCurrent && isPlaying ? `إيقاف سورة ${surah.name}` : `تشغيل سورة ${surah.name}`}
        onClick={() => (isCurrent ? onPlay(surah.number) : onPlay(surah.number))}
      >
        {isCurrent && isPlaying ? <PauseIcon width={20} height={20} /> : <PlayIcon width={20} height={20} />}
      </button>
    </li>
  );
});

export default function HomeScreen({
  lastPosition,
  onResume,
  onOpenSurah,
  onPlaySurah,
  nowPlaying,
  onTogglePlay,
}: HomeScreenProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SurahFilter>("all");
  const [hiddenResume, setHiddenResume] = useState(false);
  const [showDownloads, setShowDownloads] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const results = useSurahSearch(query, filter);
  const downloads = useDownloads();

  const downloadedList = useMemo(
    () => Object.values(downloads).sort((a, b) => a.surah - b.surah),
    [downloads],
  );
  const downloadedBytes = useMemo(
    () => downloadedList.reduce((sum, record) => sum + (record.sizeBytes || 0), 0),
    [downloadedList],
  );

  const resumeSurah = lastPosition ? getSurah(lastPosition.surah) : null;
  const nowSurah = nowPlaying ? getSurah(nowPlaying.surah) : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <BookIcon width={22} height={22} />
          </span>
          <span className="brand__text">
            <strong>المصحف المرتل</strong>
            <small>الشيخ أ.د. محمد برهجي — حفص عن عاصم</small>
          </span>
        </div>
        <div className="topbar__actions">
          <button type="button" className="icon-button" onClick={toggleTheme} aria-label="تبديل المظهر">
            {theme === "dark" ? <SunIcon width={20} height={20} /> : <MoonIcon width={20} height={20} />}
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setShowDownloads(true)}
            aria-label="السور المحمّلة"
          >
            <LayersIcon width={20} height={20} />
            {downloadedList.length > 0 && <span className="badge-dot">{downloadedList.length}</span>}
          </button>
        </div>
      </header>

      {resumeSurah && lastPosition && !hiddenResume && (
        <section className="card resume-card">
          <div className="resume-card__head">
            <span className="chip chip--accent">
              <ClockIcon width={15} height={15} /> متابعة الاستماع
            </span>
            <span className="muted small">{formatRelativeTime(lastPosition.updatedAt)}</span>
          </div>
          <h2 className="resume-card__title">سورة {resumeSurah.name}</h2>
          <p className="muted">
            الآية {lastPosition.ayah} من {resumeSurah.ayahCount} · الموضع {formatDuration(lastPosition.positionMs)}
            {lastPosition.durationMs > 0 ? ` من ${formatDuration(lastPosition.durationMs)}` : ""}
          </p>
          <div className="progress-line" aria-hidden="true">
            <span
              style={{
                inlineSize: `${lastPosition.durationMs > 0 ? Math.min(100, (lastPosition.positionMs / lastPosition.durationMs) * 100) : 0}%`,
              }}
            />
          </div>
          <div className="row gap">
            <button type="button" className="button button--primary" onClick={onResume}>
              <PlayIcon width={18} height={18} /> متابعة من الثانية نفسها
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => {
                clearLastPosition();
                setHiddenResume(true);
              }}
            >
              <XIcon width={17} height={17} /> حذف
            </button>
          </div>
        </section>
      )}

      <section className="search-block">
        <div className="search">
          <SearchIcon width={19} height={19} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث باسم السورة أو رقمها أو نطقها…"
            aria-label="البحث عن سورة"
          />
          {query && (
            <button type="button" className="icon-button icon-button--tiny" onClick={() => setQuery("")} aria-label="مسح البحث">
              <XIcon width={16} height={16} />
            </button>
          )}
        </div>
        <div className="filters" role="tablist" aria-label="تصفية السور">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              className={`chip chip--button${filter === item.id ? " is-active" : ""}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="list-block">
        <div className="list-head">
          <h2>السور</h2>
          <span className="muted small">
            {results.length} من {SURAHS.length}
          </span>
        </div>
        {results.length === 0 ? (
          <p className="empty">
            <AlertIcon width={18} height={18} /> لا توجد نتائج مطابقة
            {filter === "downloaded" ? " — لم تحمّل أي سورة بعد." : "."}
          </p>
        ) : (
          <ul className="surah-list">
            {results.map((surah) => (
              <SurahRow
                key={surah.number}
                surahNumber={surah.number}
                isCurrent={nowPlaying?.surah === surah.number}
                isPlaying={Boolean(nowPlaying?.isPlaying && nowPlaying?.surah === surah.number)}
                downloaded={Boolean(downloads[String(surah.number)])}
                onOpen={onOpenSurah}
                onPlay={(number) => (nowPlaying?.surah === number ? onTogglePlay() : onPlaySurah(number))}
              />
            ))}
          </ul>
        )}
      </section>

      <p className="footnote muted small">
        التلاوة من خوادم {`mp3quran`} الرسمية · النص برواية حفص عن عاصم (مشروع تنزيل Tanzil)
      </p>

      {nowSurah && nowPlaying && (
        <div className="mini-player">
          <button type="button" className="mini-player__info" onClick={() => onOpenSurah(nowPlaying.surah)}>
            <span className="mini-player__title">سورة {nowSurah.name}</span>
            <span className="muted small">
              {nowPlaying.ayah ? `الآية ${nowPlaying.ayah}` : "جارٍ التحميل…"} · {nowPlaying.isPlaying ? "يُشغَّل الآن" : "متوقّف"}
            </span>
          </button>
          <button type="button" className="icon-button icon-button--filled" onClick={onTogglePlay} aria-label="تشغيل/إيقاف">
            {nowPlaying.isPlaying ? <PauseIcon width={22} height={22} /> : <PlayIcon width={22} height={22} />}
          </button>
        </div>
      )}

      {showDownloads && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="السور المحمّلة">
          <div className="sheet__panel">
            <div className="sheet__head">
              <h2>السور المحمّلة</h2>
              <button type="button" className="icon-button" onClick={() => setShowDownloads(false)} aria-label="إغلاق">
                <XIcon width={20} height={20} />
              </button>
            </div>
            {!isDownloadSupported() && (
              <p className="empty">
                <AlertIcon width={18} height={18} /> التنزيل للاستماع دون إنترنت متاح في تطبيق أندرويد المُثبَّت على الجهاز.
              </p>
            )}
            {downloadedList.length === 0 ? (
              <p className="empty">لم تحمّل أي سورة بعد. اضغط أيقونة التنزيل داخل شاشة المشغّل.</p>
            ) : (
              <>
                <p className="muted small">
                  {downloadedList.length} سورة · الحجم الكلي {formatBytes(downloadedBytes)}
                </p>
                <ul className="download-list">
                  {downloadedList.map((record) => (
                    <li key={record.surah}>
                      <span>
                        سورة {getSurah(record.surah)?.name}{" "}
                        <small className="muted">{formatBytes(record.sizeBytes)}</small>
                      </span>
                      <DownloadButton surah={record.surah} variant="icon" />
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="row gap end">
              <span className="chip chip--muted">
                <CheckIcon width={15} height={15} /> تُحفظ داخل التطبيق وتعمل دون إنترنت
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
