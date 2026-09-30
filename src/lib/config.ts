/**
 * قراءة متغيرات البيئة والتحقق من وجودها — بأمانة كاملة ودون إخفاء أي نقص.
 * لا شيء هنا يُخفي المشاكل: أي متغير ناقص يظهر بوضوح في الواجهة.
 */

export interface EnvCheckRow {
  key: string;
  label: string;
  ok: boolean;
  hint: string;
  phase: "core" | "phase2";
}

export interface AppConfig {
  appUrl: string;
  googleClientId: string;
  googleClientSecret: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  sessionSecret: string;
  encryptionKey: string;
  adminEmails: string[];
  geminiApiKey: string;
  geminiModel: string;
  missingCore: string[];
}

const CORE_ENV: { key: keyof AppConfig | "ADMIN_EMAILS"; label: string; hint: string }[] = [
  { key: "googleClientId", label: "GOOGLE_CLIENT_ID", hint: "Google Cloud Console → APIs & Services → Credentials → OAuth client (Web application)" },
  { key: "googleClientSecret", label: "GOOGLE_CLIENT_SECRET", hint: "نفس صفحة Credentials — يجب أن يبقى server-side فقط" },
  { key: "supabaseUrl", label: "SUPABASE_URL", hint: "مشروع Supabase مستقل خاص بـ Rivyo (وليس مشروع MAAOUN)" },
  { key: "supabaseServiceRoleKey", label: "SUPABASE_SERVICE_ROLE_KEY", hint: "Settings → API في مشروع Rivyo على Supabase" },
  { key: "sessionSecret", label: "SESSION_SECRET", hint: "أنشئه عبر: npm run keys" },
  { key: "encryptionKey", label: "ENCRYPTION_KEY", hint: "أنشئه عبر: npm run keys" },
];

export function getAppConfig(): AppConfig {
  const env = process.env;
  const cfg: AppConfig = {
    appUrl: (env.NEXT_PUBLIC_APP_URL ?? "").trim(),
    googleClientId: (env.GOOGLE_CLIENT_ID ?? "").trim(),
    googleClientSecret: (env.GOOGLE_CLIENT_SECRET ?? "").trim(),
    supabaseUrl: (env.SUPABASE_URL ?? "").trim(),
    supabaseServiceRoleKey: (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim(),
    sessionSecret: (env.SESSION_SECRET ?? "").trim(),
    encryptionKey: (env.ENCRYPTION_KEY ?? "").trim(),
    adminEmails: (env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    geminiApiKey: (env.GEMINI_API_KEY ?? "").trim(),
    geminiModel: (env.GEMINI_MODEL ?? "gemini-flash-latest").trim() || "gemini-flash-latest",
    missingCore: [],
  };
  cfg.missingCore = CORE_ENV.filter((c) => !String(cfg[c.key as keyof AppConfig] ?? "").trim()).map((c) => c.label);
  return cfg;
}

/** صفوف فحص البيئة لصفحة /admin/google-test */
export function envCheckRows(): EnvCheckRow[] {
  const cfg = getAppConfig();
  const rows: EnvCheckRow[] = CORE_ENV.map((c) => ({
    key: c.label,
    label: c.label,
    ok: Boolean(String(cfg[c.key as keyof AppConfig] ?? "").trim()),
    hint: c.hint,
    phase: "core",
  }));
  rows.push(
    {
      key: "ADMIN_EMAILS",
      label: "ADMIN_EMAILS",
      ok: cfg.adminEmails.length > 0,
      hint: "قائمة بريد الأدمن المسموح له بالدخول إلى /admin/google-test",
      phase: "core",
    },
    {
      key: "GEMINI_API_KEY",
      label: "GEMINI_API_KEY (المرحلة الثانية)",
      ok: cfg.geminiApiKey.length > 0,
      hint: "من Google AI Studio — يُستخدم بعد نجاح اختبار تكامل Google",
      phase: "phase2",
    },
    {
      key: "GEMINI_MODEL",
      label: "GEMINI_MODEL (المرحلة الثانية)",
      ok: true,
      hint: `القيمة الحالية: ${cfg.geminiModel} — قابل للتغيير دون تعديل الكود`,
      phase: "phase2",
    },
  );
  return rows;
}
