import { RegisterSW } from "@/components/RegisterSW";
import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "aura · щоденник тіла і здоровʼя",
  description: "Мʼякий щоденник тіла і здоровʼя: вага, харчування, заміри та цілі.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "aura",
  },
};

export const viewport: Viewport = {
  themeColor: "#e5906f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

// Застосовуємо тему до першого рендера, щоб уникнути мигання.
const themeScript = `(function(){try{var t=localStorage.getItem('aura-theme');if(t==='peach'||t==='mint'||t==='lavender'){document.documentElement.dataset.theme=t;}else{document.documentElement.dataset.theme='peach';}}catch(e){document.documentElement.dataset.theme='peach';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" data-theme="peach" className={nunito.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
