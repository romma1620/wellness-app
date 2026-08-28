import { RegisterSW } from "@/components/RegisterSW";
import { BG_DARK, BG_LIGHT } from "@/lib/theme";
import { THEMES } from "@/lib/types";
import type { Metadata, Viewport } from "next";
import { Wix_Madefor_Display } from "next/font/google";
import "./globals.css";

const madefor = Wix_Madefor_Display({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
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
    statusBarStyle: "black-translucent",
    title: "aura",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: BG_DARK },
    { media: "(prefers-color-scheme: light)", color: BG_LIGHT },
  ],
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
// через matchMedia, як і в resolveMode із lib/theme-mode. Дефолт — темний,
// як у редизайні.
const themeScript = `(function(){var d=document.documentElement;try{var t=localStorage.getItem('aura-theme');d.dataset.theme=${JSON.stringify(
  THEMES,
)}.indexOf(t)>-1?t:'peach';}catch(e){d.dataset.theme='peach';}try{var m=localStorage.getItem('aura-mode');if(m!=='light'&&m!=='dark'&&m!=='system')m='dark';d.dataset.mode=m==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):m;}catch(e){d.dataset.mode='dark';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={madefor.variable} suppressHydrationWarning>
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
