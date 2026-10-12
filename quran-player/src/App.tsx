import { useCallback, useEffect, useState } from "react";
import HomeScreen from "./components/HomeScreen";
import PlayerScreen from "./components/PlayerScreen";
import { usePlayer } from "./lib/usePlayer";
import { loadLastPosition, type LastPosition } from "./lib/storage";

export default function App() {
  const player = usePlayer();
  const [screen, setScreen] = useState<{ name: "home" } | { name: "player"; surah: number }>({ name: "home" });
  const [lastPosition, setLastPosition] = useState<LastPosition | null>(null);

  // قراءة آخر موضع عند الفتح وعند العودة للرئيسية
  useEffect(() => {
    if (screen.name === "home") {
      setLastPosition(loadLastPosition());
    }
  }, [screen, player.isPlaying]);

  // مزامنة الشاشة مع السورة التي ينتقل إليها المشغّل تلقائيًا (نهاية السورة مثلًا)
  useEffect(() => {
    if (screen.name === "player" && player.surah && player.surah !== screen.surah) {
      setScreen({ name: "player", surah: player.surah });
    }
  }, [player.surah, screen]);

  // زر الرجوع في أندرويد يعود للقائمة بدل إغلاق التطبيق
  const openPlayer = useCallback((surahNumber: number) => {
    setScreen({ name: "player", surah: surahNumber });
    try {
      window.history.pushState({ quranScreen: "player" }, "");
    } catch {
      /* تجاهل */
    }
  }, []);

  const closePlayer = useCallback(() => {
    setScreen({ name: "home" });
    try {
      if ((window.history.state as { quranScreen?: string } | null)?.quranScreen === "player") {
        window.history.back();
      }
    } catch {
      /* تجاهل */
    }
  }, []);

  useEffect(() => {
    const onPopState = () => setScreen({ name: "home" });
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleResume = () => {
    const last = loadLastPosition();
    if (!last) return;
    openPlayer(last.surah);
    void player.resumeAt(last.surah, last.positionMs);
  };

  if (screen.name === "player") {
    return <PlayerScreen surahNumber={screen.surah} player={player} onBack={closePlayer} />;
  }

  return (
    <HomeScreen
      lastPosition={lastPosition}
      onResume={handleResume}
      onOpenSurah={openPlayer}
      onPlaySurah={(surah) => {
        openPlayer(surah);
        player.playSurah(surah);
      }}
      nowPlaying={
        player.surah
          ? {
              surah: player.surah,
              ayah: player.currentAyah,
              isPlaying: player.isPlaying,
            }
          : null
      }
      onTogglePlay={() => player.togglePlay()}
    />
  );
}
