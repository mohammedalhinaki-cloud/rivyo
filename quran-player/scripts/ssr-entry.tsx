/**
 * مدخل اختبار العرض (SSR) — يُبنى بواسطة scripts/smoke.mjs ثم يُنفَّذ في Node.
 * الغرض: التأكد أن شاشتي الرئيسية والمشغّل تُرسمان فعلًا بلا أخطاء زمن التشغيل،
 * وأن النصوص العربية ومحتوى السور تظهر في المخرجات.
 */
import { renderToStaticMarkup } from "react-dom/server";
import HomeScreen from "../src/components/HomeScreen";
import PlayerScreen from "../src/components/PlayerScreen";
import type { PlayerApi } from "../src/lib/usePlayer";
import type { LastPosition } from "../src/lib/storage";

export function renderHome(lastPosition: LastPosition | null): string {
  return renderToStaticMarkup(
    <HomeScreen
      lastPosition={lastPosition}
      onResume={() => undefined}
      onOpenSurah={() => undefined}
      onPlaySurah={() => undefined}
      nowPlaying={null}
      onTogglePlay={() => undefined}
    />,
  );
}

export function renderHomeNowPlaying(): string {
  return renderToStaticMarkup(
    <HomeScreen
      lastPosition={null}
      onResume={() => undefined}
      onOpenSurah={() => undefined}
      onPlaySurah={() => undefined}
      nowPlaying={{ surah: 18, ayah: 50, isPlaying: true }}
      onTogglePlay={() => undefined}
    />,
  );
}

function createFakePlayer(overrides: Partial<PlayerApi> = {}): PlayerApi {
  const noop = () => undefined;
  return {
    surah: 2,
    currentAyah: 255,
    isPlaying: false,
    isBuffering: false,
    isLoading: false,
    error: null,
    notice: null,
    currentTimeMs: 63_000,
    durationMs: 7_200_000,
    timings: [{ ayah: 255, start: 60_000, end: 70_000 }],
    timingSource: "official",
    ayahTexts: ["الٓمٓ"],
    speed: 1,
    repeatSurah: false,
    repeatAyah: 0,
    autoNextSurah: true,
    playSurah: noop,
    playFromAyah: noop,
    resumeAt: async () => undefined,
    restartSurah: noop,
    togglePlay: noop,
    pause: noop,
    seekTo: noop,
    seekBy: noop,
    nextAyah: noop,
    prevAyah: noop,
    nextSurah: noop,
    prevSurah: noop,
    retry: noop,
    setSpeed: noop,
    setRepeatSurah: noop,
    setRepeatAyah: noop,
    setAutoNextSurah: noop,
    dismissNotice: noop,
    ...overrides,
  };
}

export function renderPlayer(overrides: Partial<PlayerApi> = {}, surahNumber = 2): string {
  return renderToStaticMarkup(
    <PlayerScreen surahNumber={surahNumber} player={createFakePlayer(overrides)} onBack={() => undefined} />,
  );
}
