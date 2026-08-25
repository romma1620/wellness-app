import { RegisterSW } from "@/components/RegisterSW";
import { THEMES } from "@/lib/types";
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
  // Chrome/Android стискає layout-вьюпорт під клавіатуру, тож `fixed`-панелі
  // піднімаються самі. iOS цього не вміє — там ту саму роботу робить замір
  // visualViewport у Sheet.
  interactiveWidget: "resizes-content",
};

// Застосовуємо тему й режим до першого рендера, щоб уникнути мигання.
// data-theme/data-mode свідомо НЕ ставимо в JSX: атрибутами володіє цей скрипт
// і ThemeProvider, інакше React може перезаписати вибір користувача дефолтом.
// У data-mode кладемо вже розгорнуте light/dark — "system" розкривається тут
// через matchMedia, як і в resolveMode із lib/theme-mode.
const themeScript = `(function(){var d=document.documentElement;try{var t=localStorage.getItem('aura-theme');d.dataset.theme=${JSON.stringify(
  THEMES,
)}.indexOf(t)>-1?t:'peach';}catch(e){d.dataset.theme='peach';}try{var m=localStorage.getItem('aura-mode');if(m!=='light'&&m!=='dark'&&m!=='system')m='light';d.dataset.mode=m==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):m;}catch(e){d.dataset.mode='light';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={nunito.variable} suppressHydrationWarning>
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
