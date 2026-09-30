import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Rivyo — ردود ذكية على تقييمات Google",
    template: "%s | Rivyo",
  },
  description:
    "اربط نشاطك التجاري على Google، واقرأ تقييمات عملائك، واحصل على ردود عربية طبيعية بالذكاء الاصطناعي — بموافقتك قبل النشر دائمًا.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#216159",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="flex min-h-dvh flex-col font-sans">
        {/* خط تجوال يُحمَّل من متصفح المستخدم مع بديل خطوط النظام — لا اعتماد على الشبكة وقت البناء */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
        {children}
      </body>
    </html>
  );
}
