import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSurah } from "../data/surahs";
import { RECITER } from "../lib/audio-sources";
import { formatDuration } from "../lib/format";
import { timingForAyah } from "../lib/player-math";
import type { PlayerApi } from "../lib/usePlayer";
import { DownloadButton } from "./DownloadButton";
import {
  AlertIcon,
  BackIcon,
  CheckIcon,
  ListIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  RefreshIcon,
  RepeatIcon,
  XIcon,
} from "./Icons";

export interface PlayerScreenProps {
  surahNumber: number;
  player: PlayerApi;
  onBack: () => void;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

/** خيارات إعادة الآية: القيمة = عدد المرات الإضافية */
const REPEAT_AYAH_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: "بدون" },
  { value: 1, label: "×2" },
  { value: 2, label: "×3" },
  { value: 4, label: "×5" },
];

export default function PlayerScreen({ surahNumber, player, onBack }: PlayerScreenProps) {
  const surah = getSurah(surahNumber);
  const [showAyahGrid, setShowAyahGrid] = useState(false);
  const [ayahInput, setAyahInput] = useState("");
  const [dragValue, setDragValue] = useState<number | null>(null);

  const { playSurah, surah: activeSurah } = player;

  /** تحميل السورة عند فتح الشاشة (يستكمل آخر موضع محفوظ لها إن وُجد) */
  useEffect(() => {
    if (activeSurah !== surahNumber) playSurah(surahNumber);
  }, [activeSurah, surahNumber, playSurah]);

  const ayahCount = surah?.ayahCount ?? 0;
  const currentAyah = player.currentAyah;
  const currentTiming = useMemo(
    () => (currentAyah != null ? timingForAyah(player.timings, currentAyah) : null),
    [currentAyah, player.timings],
  );
  const progressValue = dragValue ?? Math.round(player.currentTimeMs);
  const duration = Math.max(player.durationMs, 1);

  const commitSeek = useCallback(
    (value: number) => {
      player.seekTo(value);
      setDragValue(null);
    },
    [player],
  );

  const jumpToAyah = useCallback(() => {
    const parsed = Number(ayahInput);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > ayahCount) return;
    player.playFromAyah(surahNumber, parsed);
    setAyahInput("");
    setShowAyahGrid(false);
  }, [ayahCount, ayahInput, player, surahNumber]);

  if (!surah) {
    return (
      <div className="app">
        <p className="empty">سورة غير معروفة.</p>
        <button type="button" className="button button--primary" onClick={onBack}>
          <BackIcon width={18} height={18} /> عودة
        </button>
      </div>
    );
  }

  return (
    <div className="app app--player">
      <header className="topbar player-topbar">
        <button type="button" className="icon-button" onClick={onBack} aria-label="رجوع إلى قائمة السور">
          <BackIcon width={22} height={22} />
        </button>
        <div className="player-title">
          <strong>سورة {surah.name}</strong>
          <small>
            {RECITER.shortName} · {surah.ayahCount} آية · الجزء {surah.juzStart}
          </small>
        </div>
        <DownloadButton surah={surahNumber} />
      </header>

      {player.notice && (
        <div className="banner banner--info">
          <CheckIcon width={17} height={17} />
          <span>{player.notice}</span>
          <button type="button" className="icon-button icon-button--tiny" onClick={player.dismissNotice} aria-label="إغلاق">
            <XIcon width={15} height={15} />
          </button>
        </div>
      )}

      {player.error && (
        <div className="banner banner--error">
          <AlertIcon width={17} height={17} />
          <span>{player.error}</span>
          <button type="button" className="button button--ghost button--small" onClick={player.retry}>
            <RefreshIcon width={15} height={15} /> إعادة
          </button>
        </div>
      )}

      {player.timingSource === "estimated" && (
        <div className="banner banner--warn">
          <AlertIcon width={17} height={17} />
          <span>
            تعذّر جلب فهرس التوقيتات الرسمي لهذه السورة — الانتقال بين الآيات الآن <strong>تقديري</strong> (توزيع متساٍ
            على عدد الآيات)، والتشغيل نفسه سليم.
          </span>
        </div>
      )}

      {player.timingSource === null && !player.error && (
        <div className="banner banner--muted">
          <RefreshIcon width={16} height={16} />
          <span>جارٍ جلب توقيتات الآيات الرسمية…</span>
        </div>
      )}

      <section className="ayah-card ayah-card--audio">
        <div className="ayah-card__head">
          <span className="chip chip--accent">
            الآية {currentAyah ?? "—"} من {surah.ayahCount}
          </span>
          {player.isBuffering && <span className="chip chip--muted">جارٍ التحميل…</span>}
        </div>
        <div className="ayah-card__number" aria-hidden="true">
          {currentAyah ?? "•"}
        </div>
        <p className="ayah-card__meta">
          {currentTiming
            ? `تبدأ عند ${formatDuration(currentTiming.start)} وتنتهي عند ${formatDuration(currentTiming.end)}`
            : "بانتظار توقيتات الآيات…"}
        </p>
        <p className="ayah-card__hint muted small">
          التطبيق صوت فقط — اختر أي آية من الأسفل أو من شبكة الأرقام وسيبدأ التشغيل من بدايتها تمامًا.
        </p>
      </section>

      <div className="progress-block">
        <input
          className="range"
          type="range"
          min={0}
          max={duration}
          step={500}
          value={progressValue}
          disabled={player.durationMs <= 0}
          onChange={(event) => setDragValue(Number(event.target.value))}
          onPointerUp={() => dragValue != null && commitSeek(dragValue)}
          onKeyUp={() => dragValue != null && commitSeek(dragValue)}
          onTouchEnd={() => dragValue != null && commitSeek(dragValue)}
          aria-label="شريط التقدّم"
        />
        <div className="progress-block__times">
          <span>{formatDuration(progressValue)}</span>
          <span className="muted">{formatDuration(player.durationMs)}</span>
        </div>
      </div>

      <div className="controls">
        <button type="button" className="icon-button icon-button--soft" onClick={player.prevSurah} aria-label="السورة السابقة">
          <PrevIcon width={22} height={22} />
          <span className="icon-button__caption">سورة</span>
        </button>
        <button type="button" className="icon-button icon-button--soft" onClick={player.prevAyah} aria-label="الآية السابقة">
          <PrevIcon width={20} height={20} />
          <span className="icon-button__caption">آية</span>
        </button>
        <button type="button" className="play-button" onClick={player.togglePlay} aria-label="تشغيل/إيقاف">
          {player.isPlaying ? <PauseIcon width={34} height={34} /> : <PlayIcon width={34} height={34} />}
        </button>
        <button type="button" className="icon-button icon-button--soft" onClick={player.nextAyah} aria-label="الآية التالية">
          <NextIcon width={20} height={20} />
          <span className="icon-button__caption">آية</span>
        </button>
        <button type="button" className="icon-button icon-button--soft" onClick={player.nextSurah} aria-label="السورة التالية">
          <NextIcon width={22} height={22} />
          <span className="icon-button__caption">سورة</span>
        </button>
      </div>

      <div className="controls-secondary">
        <button type="button" className="chip chip--button" onClick={() => player.seekBy(-10000)}>
          ‑ ١٠ ثوانٍ
        </button>
        <button type="button" className="chip chip--button" onClick={() => player.seekBy(10000)}>
          + ١٠ ثوانٍ
        </button>
        <button type="button" className="chip chip--button" onClick={() => setShowAyahGrid(true)}>
          <ListIcon width={16} height={16} /> اختيار آية
        </button>
        <button type="button" className="chip chip--button" onClick={player.restartSurah}>
          <RepeatIcon width={16} height={16} /> من البداية
        </button>
      </div>

      <section className="card jump-card">
        <h3>الانتقال إلى آية</h3>
        <div className="row gap">
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={1}
            max={surah.ayahCount}
            placeholder={`1 – ${surah.ayahCount}`}
            value={ayahInput}
            onChange={(event) => setAyahInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && jumpToAyah()}
            aria-label="رقم الآية"
          />
          <button type="button" className="button button--primary" onClick={jumpToAyah} disabled={!ayahInput}>
            <PlayIcon width={17} height={17} /> تشغيل من هنا
          </button>
        </div>
        <p className="muted small">يبدأ التشغيل من بداية الآية المطلوبة تمامًا اعتمادًا على التوقيتات الرسمية.</p>
      </section>

      <section className="card settings-card">
        <div className="setting-row">
          <span className="setting-row__label">سرعة التلاوة</span>
          <div className="chips">
            {SPEEDS.map((speed) => (
              <button
                key={speed}
                type="button"
                className={`chip chip--button${player.speed === speed ? " is-active" : ""}`}
                onClick={() => player.setSpeed(speed)}
              >
                {speed}×
              </button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <span className="setting-row__label">تكرار الآية</span>
          <div className="chips">
            {REPEAT_AYAH_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`chip chip--button${player.repeatAyah === option.value ? " is-active" : ""}`}
                onClick={() => player.setRepeatAyah(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <label className="setting-row setting-row--toggle">
          <span className="setting-row__label">تكرار السورة كاملة</span>
          <input
            type="checkbox"
            className="switch"
            checked={player.repeatSurah}
            onChange={(event) => player.setRepeatSurah(event.target.checked)}
          />
        </label>
        <label className="setting-row setting-row--toggle">
          <span className="setting-row__label">الانتقال تلقائيًا للسورة التالية</span>
          <input
            type="checkbox"
            className="switch"
            checked={player.autoNextSurah}
            onChange={(event) => player.setAutoNextSurah(event.target.checked)}
          />
        </label>
      </section>

      <p className="muted small source-note">
        المصدر: {RECITER.sourceName} — {RECITER.rewaya}
        {player.timingSource === "official" ? " · توقيتات الآيات رسمية" : ""}
        {player.timingSource === "estimated" ? " · التوقيتات تقديرية" : ""}
      </p>

      {showAyahGrid && (
        <AyahGridSheet
          surahName={surah.name}
          ayahCount={ayahCount}
          currentAyah={currentAyah}
          onSelect={(ayah) => {
            player.playFromAyah(surahNumber, ayah);
            setShowAyahGrid(false);
          }}
          onClose={() => setShowAyahGrid(false)}
        />
      )}
    </div>
  );
}

interface AyahGridSheetProps {
  surahName: string;
  ayahCount: number;
  currentAyah: number | null;
  onSelect: (ayah: number) => void;
  onClose: () => void;
}

/** شبكة أرقام الآيات (بلا نص) — اختيار سريع بأي إصبع. */
const AyahGridSheet = memo(function AyahGridSheet({
  surahName,
  ayahCount,
  currentAyah,
  onSelect,
  onClose,
}: AyahGridSheetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const numbers = useMemo(() => Array.from({ length: ayahCount }, (_v, index) => index + 1), [ayahCount]);

  useEffect(() => {
    const node = containerRef.current?.querySelector<HTMLElement>(".ayah-grid__cell.is-current");
    node?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [currentAyah]);

  return (
    <div className="sheet sheet--full" role="dialog" aria-modal="true" aria-label={`اختيار آية من سورة ${surahName}`}>
      <div className="sheet__panel" ref={containerRef}>
        <div className="sheet__head">
          <h2>اختر آية من سورة {surahName}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق">
            <XIcon width={20} height={20} />
          </button>
        </div>
        <div className="ayah-grid">
          {numbers.map((ayah) => (
            <button
              key={ayah}
              type="button"
              className={`ayah-grid__cell${currentAyah === ayah ? " is-current" : ""}`}
              onClick={() => onSelect(ayah)}
              aria-label={`تشغيل من الآية ${ayah}`}
            >
              {ayah}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
