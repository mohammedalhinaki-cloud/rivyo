import type { NextConfig } from "next";

/**
 * Rivyo — Next.js config
 * لا توضع أي أسرار هنا إطلاقًا. كل العمليات الحساسة (OAuth, Tokens, Gemini) تتم server-side فقط.
 */
const devOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  ...(devOrigins.length > 0 ? { allowedDevOrigins: devOrigins } : {}),
};

export default nextConfig;
