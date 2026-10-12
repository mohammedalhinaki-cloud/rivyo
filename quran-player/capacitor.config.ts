import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.rivyo.quran",
  appName: "المصحف المرتل",
  webDir: "dist",
  android: {
    backgroundColor: "#070c10",
    allowMixedContent: false,
    captureInput: true,
  },
  server: {
    androidScheme: "https",
  },
  plugins: {
    // يجعل نداءات fetch/XHR تمر عبر الطبقة الأصلية (بلا قيود CORS) — مهم لواجهة
    // توقيتات mp3quran وواجهة المقرئين داخل تطبيق أندرويد.
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: "#070c10",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
  },
};

export default config;
