/**
 * محرّك التشغيل: عنصر صوت واحد + فهرس التوقيتات الرسمية + الحفظ التلقائي للموضع.
 *
 * قرارات تصميمية مهمة:
 *  - لا يوجد أي صوت داخل حزمة التطبيق: التلاوة تُبَث من خوادم mp3quran الرسمية،
 *    والنسخة المحمّلة (إن وُجدت) تتقدَّم على البث.
 *  - التوقيتات الرسمية (read=340) هي الأساس؛ وعند تعذّر جلبها يُستعمل تقدير محلي
 *    نسبي إلى طول كل آية، مع إظهار تنبيه صريح في الواجهة.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSurah } from "../data/surahs";
import { resolveAudioSources } from "./audio-sources";
import { getLocalAudioUrl } from "./downloads";
import { ayahAtTime, clamp, estimateTimings, previousAyahTarget, timingForAyah } from "./player-math";
import { getCachedSurahText, getSurahText } from "./text";
import {
  DEFAULT_SETTINGS,
  loadLastPosition,
  loadPerSurahPosition,
  loadSettings,
  saveLastPosition,
  saveSettings,
} from "./storage";
import { fetchOfficialTimings, getCachedTimings } from "./timings";
import type { AppSettings, AyahTiming, LastPosition, TimingSource } from "./types";

const TICK_MS = 250;
const AUTOSAVE_MS = 1500;
const RESUME_MIN_MS = 3000;
const MIN_SAVE_MS = 500;

export interface PlayerApi {
  /** رقم السورة المشغّلة حاليًا (null = لا شيء) */
  surah: number | null;
  /** رقم الآية الحالية (null قبل جهوزية التوقيتات) */
  currentAyah: number | null;
  isPlaying: boolean;
  isBuffering: boolean;
  isLoading: boolean;
  error: string | null;
  /** تنبيه مؤقت (استكمال من موضع محفوظ، انتقال لسورة تالية...) */
  notice: string | null;
  currentTimeMs: number;
  durationMs: number;
  timings: AyahTiming[] | null;
  timingSource: TimingSource | null;
  ayahTexts: string[] | null;
  speed: number;
  repeatSurah: boolean;
  repeatAyah: number;
  autoNextSurah: boolean;
  playSurah: (surah: number, options?: { fromStart?: boolean }) => void;
  playFromAyah: (surah: number, ayah: number) => void;
  resumeAt: (surah: number, positionMs: number) => Promise<void>;
  restartSurah: () => void;
  togglePlay: () => void;
  pause: () => void;
  seekTo: (positionMs: number) => void;
  seekBy: (deltaMs: number) => void;
  nextAyah: () => void;
  prevAyah: () => void;
  nextSurah: () => void;
  prevSurah: () => void;
  retry: () => void;
  setSpeed: (speed: number) => void;
  setRepeatSurah: (value: boolean) => void;
  setRepeatAyah: (count: number) => void;
  setAutoNextSurah: (value: boolean) => void;
  dismissNotice: () => void;
}

export function usePlayer(): PlayerApi {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourcesRef = useRef<string[]>([]);
  const sourceIndexRef = useRef(0);
  const sessionRef = useRef(0);
  const pendingSeekRef = useRef<number | null>(null);
  const pendingAyahRef = useRef<number | null>(null);
  const repeatLeftRef = useRef(0);
  const lastPersistRef = useRef(0);
  const settingsRef = useRef<AppSettings>(loadSettings());
  const endedHandlerRef = useRef<() => void>(() => undefined);
  const errorHandlerRef = useRef<() => void>(() => undefined);
  const currentAyahRef = useRef<number | null>(null);
  const togglePlayRef = useRef<() => void>(() => undefined);
  const nextAyahRef = useRef<() => void>(() => undefined);
  const prevAyahRef = useRef<() => void>(() => undefined);
  const seekByRef = useRef<(deltaMs: number) => void>(() => undefined);

  const [surah, setSurah] = useState<number | null>(null);
  const [currentAyah, setCurrentAyah] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [timings, setTimings] = useState<AyahTiming[] | null>(null);
  const [timingSource, setTimingSource] = useState<TimingSource | null>(null);
  const [ayahTexts, setAyahTexts] = useState<string[] | null>(null);
  const [settings, setSettings] = useState<AppSettings>(settingsRef.current);

  const surahRef = useRef<number | null>(null);
  const timingsRef = useRef<AyahTiming[] | null>(null);
  const durationRef = useRef(0);
  surahRef.current = surah;
  timingsRef.current = timings;
  durationRef.current = durationMs;
  settingsRef.current = settings;

  const surahMeta = useMemo(() => getSurah(surah), [surah]);
  const isLoading = isBuffering && !isPlaying && !error;

  /** حفظ الموضع الحالي. */
  const persist = useCallback(() => {
    const audio = audioRef.current;
    const currentSurah = surahRef.current;
    if (!audio || !currentSurah) return;
    const positionMs = Math.round((audio.currentTime || 0) * 1000);
    const duration = Math.round(((audio.duration || 0) * 1000) || durationRef.current);
    // لا نحفظ مواضع أقل من نصف ثانية (لا قيمة لاستكمالها) وتمنع الكتابة فوق موضع أطول
    if (positionMs < MIN_SAVE_MS) return;
    const ayah = ayahAtTime(timingsRef.current, positionMs) ?? currentAyahRef.current ?? 1;
    const position: LastPosition = {
      surah: currentSurah,
      ayah,
      positionMs,
      durationMs: Number.isFinite(duration) ? duration : 0,
      updatedAt: Date.now(),
    };
    saveLastPosition(position);
  }, []);

  currentAyahRef.current = currentAyah;

  /** إنشاء عنصر الصوت مرة واحدة مع ربط الأحداث. */
  const ensureAudio = useCallback((): HTMLAudioElement => {
    if (audioRef.current) return audioRef.current;
    const audio = new Audio();
    audio.preload = "auto";
    audio.setAttribute("playsinline", "true");

    audio.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(audio.duration)) {
        setDurationMs(Math.round(audio.duration * 1000));
      }
      const pending = pendingSeekRef.current;
      if (pending != null) {
        pendingSeekRef.current = null;
        try {
          audio.currentTime = clamp(pending, 0, Math.max(0, (audio.duration || 0) * 1000 - 500)) / 1000;
        } catch {
          /* تجاهل */
        }
      }
    });
    audio.addEventListener("durationchange", () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDurationMs(Math.round(audio.duration * 1000));
    });
    audio.addEventListener("play", () => setIsPlaying(true));
    audio.addEventListener("playing", () => {
      setIsPlaying(true);
      setIsBuffering(false);
    });
    audio.addEventListener("pause", () => {
      setIsPlaying(false);
      persist();
    });
    audio.addEventListener("waiting", () => setIsBuffering(true));
    audio.addEventListener("stalled", () => setIsBuffering(true));
    audio.addEventListener("ended", () => endedHandlerRef.current());
    audio.addEventListener("error", () => errorHandlerRef.current());

    audioRef.current = audio;
    return audio;
  }, [persist]);

  /** تشغيل سورة (مع إمكانية البدء من موضع أو آية محددة). */
  const startSurah = useCallback(
    async (surahNumber: number, options: { positionMs?: number; ayah?: number; autoplay?: boolean } = {}) => {
      const meta = getSurah(surahNumber);
      if (!meta) return;
      const session = ++sessionRef.current;
      const audio = ensureAudio();
      audio.pause();
      audio.currentTime = 0;
      setError(null);
      setIsBuffering(Boolean(options.autoplay));
      setSurah(surahNumber);
      surahRef.current = surahNumber;
      repeatLeftRef.current = settingsRef.current.repeatAyah;

      /* 1) التوقيتات: كاش فوري ثم تحديث من الواجهة الرسمية */
      const cached = getCachedTimings(surahNumber);
      setTimings(cached);
      setTimingSource(cached ? "official" : null);
      timingsRef.current = cached;
      if (!cached) {
        fetchOfficialTimings(surahNumber, meta.ayahCount)
          .then((result) => {
            if (sessionRef.current !== session) return;
            setTimings(result.timings);
            setTimingSource("official");
          })
          .catch(() => {
            if (sessionRef.current !== session) return;
            setTimingSource("estimated");
          });
      }

      /* 2) نص السورة (للعرض وتقدير التوقيتات عند الحاجة) */
      const cachedText = getCachedSurahText(surahNumber);
      setAyahTexts(cachedText?.ayahs ?? null);
      if (!cachedText) {
        void getSurahText(surahNumber).then((text) => {
          if (sessionRef.current === session && text) setAyahTexts(text.ayahs);
        });
      }

      /* 3) تحديد موضع البداية */
      const targetTiming = options.ayah != null ? timingForAyah(cached, options.ayah) : null;
      const initialMs = targetTiming ? targetTiming.start : (options.positionMs ?? 0);
      pendingSeekRef.current = initialMs > 0 ? initialMs : null;
      pendingAyahRef.current = targetTiming ? null : (options.ayah ?? null);
      setCurrentTimeMs(initialMs);
      setCurrentAyah(options.ayah ?? (cached ? (ayahAtTime(cached, initialMs) ?? 1) : null));
      setDurationMs(0);

      /* 4) المصادر: المحمّل أولًا ثم السيرفر الأساسي ثم البديل */
      const sources = await resolveAudioSources(surahNumber, getLocalAudioUrl(surahNumber));
      if (sessionRef.current !== session) return;
      sourcesRef.current = sources;
      sourceIndexRef.current = 0;
      audio.src = sources[0];
      audio.playbackRate = settingsRef.current.speed;
      audio.load();
      if (options.autoplay) {
        void audio.play().catch(() => {
          if (sessionRef.current !== session) return;
          setIsPlaying(false);
          setIsBuffering(false);
          setError("تعذّر بدء التشغيل — تحقّق من اتصال الإنترنت أو حمّل السورة مسبقًا.");
        });
      }
    },
    [ensureAudio],
  );

  /* --------------------------- معالجات الأحداث --------------------------- */

  endedHandlerRef.current = () => {
    const audio = audioRef.current;
    const currentSurah = surahRef.current;
    if (!audio || !currentSurah) return;
    if (settingsRef.current.repeatSurah) {
      audio.currentTime = 0;
      void audio.play();
      return;
    }
    persist();
    if (settingsRef.current.autoNextSurah && currentSurah < 114) {
      setNotice(`انتهت سورة ${getSurah(currentSurah)?.name ?? ""} — بدء السورة التالية`);
      void startSurah(currentSurah + 1, { autoplay: true });
      return;
    }
    setIsPlaying(false);
    setNotice(`اكتملت سورة ${getSurah(currentSurah)?.name ?? ""}`);
  };

  errorHandlerRef.current = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextIndex = sourceIndexRef.current + 1;
    if (nextIndex < sourcesRef.current.length) {
      sourceIndexRef.current = nextIndex;
      const wasPlaying = isPlaying;
      audio.src = sourcesRef.current[nextIndex];
      audio.load();
      if (wasPlaying) void audio.play().catch(() => undefined);
      return;
    }
    setIsPlaying(false);
    setIsBuffering(false);
    setError(
      navigator.onLine === false
        ? "لا يوجد اتصال بالإنترنت، وهذه السورة غير محمّلة على الجهاز."
        : "تعذّر تشغيل التلاوة من الخادم. حاول مرة أخرى أو حمّل السورة للاستماع دون إنترنت.",
    );
  };

  /* --------------------------- حلقة التتبع --------------------------- */

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      const audio = audioRef.current;
      if (!audio) return;
      const nowMs = (audio.currentTime || 0) * 1000;
      setCurrentTimeMs(nowMs);
      const currentTimings = timingsRef.current;
      const ayah = ayahAtTime(currentTimings, nowMs);
      if (ayah != null) {
        setCurrentAyah((previous) => (previous === ayah ? previous : ayah));
        /* إعادة الآية: نرجع لبدايتها عند تجاوز نهايتها */
        if (repeatLeftRef.current > 0) {
          const timing = timingForAyah(currentTimings, ayah);
          if (timing && nowMs >= timing.end - 80) {
            repeatLeftRef.current -= 1;
            audio.currentTime = timing.start / 1000;
          }
        }
      }
      if (Date.now() - lastPersistRef.current > AUTOSAVE_MS) {
        lastPersistRef.current = Date.now();
        persist();
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [isPlaying, persist]);

  /* تطبيق طلب «ابدأ من الآية» بمجرد جهوزية التوقيتات */
  useEffect(() => {
    const target = pendingAyahRef.current;
    if (target == null || !timings) return;
    const timing = timingForAyah(timings, target);
    if (!timing) return;
    pendingAyahRef.current = null;
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.readyState >= 1) {
      audio.currentTime = timing.start / 1000;
    } else {
      pendingSeekRef.current = timing.start;
    }
    setCurrentTimeMs(timing.start);
  }, [timings]);

  /* تقدير التوقيتات عند تعذّر الجلب الرسمي (نسبيًا إلى طول الآيات) */
  useEffect(() => {
    if (timingSource !== "estimated" || !surah || durationMs <= 0) return;
    let cancelled = false;
    void getSurahText(surah).then((text) => {
      if (cancelled || !text) return;
      setTimings(estimateTimings(text.ayahs, durationMs));
    });
    return () => {
      cancelled = true;
    };
  }, [timingSource, surah, durationMs]);

  /* الحفظ عند مغادرة الصفحة أو تصغير التطبيق */
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") persist();
    };
    const onLeave = () => persist();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
      persist();
    };
  }, [persist]);

  /* أزرار شاشة القفل / الإشعارات (MediaSession) */
  useEffect(() => {
    const mediaSession = navigator.mediaSession;
    if (!mediaSession || !surah || !surahMeta) return;
    try {
      mediaSession.metadata = new MediaMetadata({
        title: `سورة ${surahMeta.name}`,
        artist: "الشيخ أ.د. محمد برهجي",
        album: `المصحف المرتل — حفص عن عاصم · الجزء ${surahMeta.juzStart}`,
        artwork: [
          { src: `${import.meta.env.BASE_URL}icons/icon-192.png`, sizes: "192x192", type: "image/png" },
          { src: `${import.meta.env.BASE_URL}icons/icon-512.png`, sizes: "512x512", type: "image/png" },
        ],
      });
      mediaSession.playbackState = isPlaying ? "playing" : "paused";
      mediaSession.setActionHandler("play", () => togglePlayRef.current());
      mediaSession.setActionHandler("pause", () => togglePlayRef.current());
      mediaSession.setActionHandler("nexttrack", () => nextAyahRef.current());
      mediaSession.setActionHandler("previoustrack", () => prevAyahRef.current());
      mediaSession.setActionHandler("seekbackward", () => seekByRef.current(-10000));
      mediaSession.setActionHandler("seekforward", () => seekByRef.current(10000));
    } catch {
      /* بعض المتصفحات لا تدعم كل الإجراءات */
    }
  }, [surah, surahMeta, isPlaying]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = surah ? (isPlaying ? "playing" : "paused") : "none";
  }, [surah, isPlaying]);

  /* --------------------------- الأوامر العامة --------------------------- */

  const togglePlay = useCallback(() => {
    const audio = ensureAudio();
    if (!surahRef.current) return;
    if (audio.paused) {
      void audio.play().catch(() => setError("تعذّر بدء التشغيل — تحقّق من الاتصال بالإنترنت."));
    } else {
      audio.pause();
    }
  }, [ensureAudio]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const seekTo = useCallback((positionMs: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const maxMs = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration * 1000 : positionMs;
    const target = clamp(positionMs, 0, maxMs);
    try {
      audio.currentTime = target / 1000;
    } catch {
      /* تجاهل */
    }
    setCurrentTimeMs(target);
  }, []);

  const seekBy = useCallback(
    (deltaMs: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      seekTo((audio.currentTime || 0) * 1000 + deltaMs);
    },
    [seekTo],
  );

  const playFromAyah = useCallback(
    (surahNumber: number, ayah: number) => {
      repeatLeftRef.current = settingsRef.current.repeatAyah;
      if (surahRef.current !== surahNumber) {
        void startSurah(surahNumber, { ayah, autoplay: true });
        return;
      }
      const timing = timingForAyah(timingsRef.current, ayah);
      if (timing) {
        pendingAyahRef.current = null;
        seekTo(timing.start);
        setCurrentAyah(ayah);
      } else {
        pendingAyahRef.current = ayah;
      }
      const audio = ensureAudio();
      if (audio.paused) void audio.play().catch(() => undefined);
    },
    [ensureAudio, seekTo, startSurah],
  );

  const nextAyah = useCallback(() => {
    const current = currentAyahRef.current;
    const timingsNow = timingsRef.current;
    if (!current || !timingsNow || !surahRef.current) {
      seekBy(15000);
      return;
    }
    repeatLeftRef.current = settingsRef.current.repeatAyah;
    const meta = getSurah(surahRef.current);
    if (meta && current >= meta.ayahCount) {
      if (surahRef.current < 114) void startSurah(surahRef.current + 1, { autoplay: true });
      else seekTo(durationRef.current);
      return;
    }
    const next = timingForAyah(timingsNow, current + 1);
    if (next) {
      pendingAyahRef.current = null;
      seekTo(next.start);
      setCurrentAyah(current + 1);
    }
  }, [seekBy, seekTo, startSurah]);

  const prevAyah = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const current = currentAyahRef.current;
    if (current && current <= 1 && (audio.currentTime || 0) < 2) {
      if (surahRef.current && surahRef.current > 1) {
        void startSurah(surahRef.current - 1, { autoplay: true });
        return;
      }
    }
    repeatLeftRef.current = settingsRef.current.repeatAyah;
    const target = previousAyahTarget(timingsRef.current, (audio.currentTime || 0) * 1000);
    if (target == null) {
      seekTo(0);
      return;
    }
    pendingAyahRef.current = null;
    seekTo(target);
    setCurrentAyah(ayahAtTime(timingsRef.current, target + 1));
  }, [seekTo, startSurah]);

  const nextSurah = useCallback(() => {
    const current = surahRef.current ?? 0;
    if (current < 114) void startSurah(current + 1, { autoplay: true });
  }, [startSurah]);

  const prevSurah = useCallback(() => {
    const current = surahRef.current ?? 2;
    if (current > 1) void startSurah(current - 1, { autoplay: true });
  }, [startSurah]);

  const restartSurah = useCallback(() => {
    if (surahRef.current) void startSurah(surahRef.current, { autoplay: true, positionMs: 0 });
  }, [startSurah]);

  const playSurah = useCallback(
    (surahNumber: number, options: { fromStart?: boolean } = {}) => {
      const saved = options.fromStart ? null : loadPerSurahPosition(surahNumber);
      const globalLast = options.fromStart ? null : loadLastPosition();
      const resumeFrom = saved && saved.positionMs > RESUME_MIN_MS ? saved : globalLast && globalLast.surah === surahNumber && globalLast.positionMs > RESUME_MIN_MS ? globalLast : null;
      if (resumeFrom) {
        setNotice(`استُكمل الاستماع من الآية ${resumeFrom.ayah}`);
        void startSurah(surahNumber, { positionMs: resumeFrom.positionMs, ayah: resumeFrom.ayah, autoplay: true });
        return;
      }
      void startSurah(surahNumber, { autoplay: true });
    },
    [startSurah],
  );

  const resumeAt = useCallback(
    async (surahNumber: number, positionMs: number) => {
      await startSurah(surahNumber, { positionMs, autoplay: true });
    },
    [startSurah],
  );

  const retry = useCallback(() => {
    if (surahRef.current) void startSurah(surahRef.current, { positionMs: (audioRef.current?.currentTime ?? 0) * 1000, autoplay: true });
  }, [startSurah]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const setSpeed = useCallback(
    (speed: number) => {
      updateSettings({ speed });
      const audio = audioRef.current;
      if (audio) audio.playbackRate = speed;
    },
    [updateSettings],
  );

  const setRepeatSurah = useCallback((value: boolean) => updateSettings({ repeatSurah: value }), [updateSettings]);

  const setRepeatAyah = useCallback(
    (count: number) => {
      repeatLeftRef.current = count;
      updateSettings({ repeatAyah: count });
    },
    [updateSettings],
  );

  const setAutoNextSurah = useCallback((value: boolean) => updateSettings({ autoNextSurah: value }), [updateSettings]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  /* مراجع ثابتة لمعالجات MediaSession (تعمل داخل مستمعين لا يُعاد بناؤهم) */
  togglePlayRef.current = togglePlay;
  nextAyahRef.current = nextAyah;
  prevAyahRef.current = prevAyah;
  seekByRef.current = seekBy;

  return {
    surah,
    currentAyah,
    isPlaying,
    isBuffering,
    isLoading,
    error,
    notice,
    currentTimeMs,
    durationMs,
    timings,
    timingSource,
    ayahTexts,
    speed: settings.speed ?? DEFAULT_SETTINGS.speed,
    repeatSurah: settings.repeatSurah,
    repeatAyah: settings.repeatAyah,
    autoNextSurah: settings.autoNextSurah,
    playSurah,
    playFromAyah,
    resumeAt,
    restartSurah,
    togglePlay,
    pause,
    seekTo,
    seekBy,
    nextAyah,
    prevAyah,
    nextSurah,
    prevSurah,
    retry,
    setSpeed,
    setRepeatSurah,
    setRepeatAyah,
    setAutoNextSurah,
    dismissNotice,
  };
}
