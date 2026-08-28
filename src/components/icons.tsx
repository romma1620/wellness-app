import type { SVGProps } from "react";

/**
 * Єдиний набір лінійних іконок редизайну (viewBox 22×22, stroke, без емодзі).
 * Контури 1:1 з Aura — Redesign.dc.html; колір — `currentColor`, тож іконка
 * бере колір тексту батька (`text-accent`, `text-muted`…).
 */
export type IconName =
  | "calendar"
  | "bars"
  | "dumbbell"
  | "bulb"
  | "user"
  | "sun"
  | "moon"
  | "check"
  | "arrowUp"
  | "arrowDown"
  | "chevronLeft"
  | "chevronRight"
  | "chevronDown"
  | "scale"
  | "fork"
  | "leaf"
  | "pencil"
  | "plus"
  | "x"
  | "activity"
  | "file"
  | "target"
  | "grid"
  | "droplet"
  | "bolt"
  | "sliders"
  | "lock"
  | "camera"
  | "download"
  | "logout"
  | "info"
  | "crescent"
  | "ruler"
  | "cycle"
  | "clock"
  | "trash"
  | "search";

const PATHS: Record<IconName, React.ReactNode> = {
  calendar: (
    <>
      <rect x="3" y="4.5" width="16" height="15" rx="3.5" />
      <path d="M3 9h16M7 2.5v3M15 2.5v3" />
    </>
  ),
  bars: <path d="M3.5 18.5h15M6 15v-4M11 15V6M16 15v-6" />,
  dumbbell: <path d="M4 8.5v5M18 8.5v5M6.5 7v8M15.5 7v8M6.5 11h9" />,
  bulb: (
    <>
      <path d="M11 3a5.6 5.6 0 0 1 3.2 10.2c-.7.5-1.2 1.2-1.2 2v.3H9v-.3c0-.8-.5-1.5-1.2-2A5.6 5.6 0 0 1 11 3z" />
      <path d="M9.2 19h3.6" />
    </>
  ),
  user: (
    <>
      <circle cx="11" cy="8" r="3.6" />
      <path d="M4.5 18.5a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  sun: (
    <>
      <circle cx="11" cy="11" r="3.6" />
      <path d="M11 2.5v2M11 17.5v2M2.5 11h2M17.5 11h2M5 5l1.4 1.4M15.6 15.6L17 17M17 5l-1.4 1.4M6.4 15.6L5 17" />
    </>
  ),
  moon: <path d="M18 13.5A7.5 7.5 0 0 1 8.5 4 7.5 7.5 0 1 0 18 13.5z" />,
  crescent: <path d="M18 13.5A7.5 7.5 0 0 1 8.5 4 7.5 7.5 0 1 0 18 13.5z" />,
  check: <path d="M4.5 11.5l4.5 4.5 8.5-9" />,
  arrowUp: <path d="M11 17V5M6 10l5-5 5 5" />,
  arrowDown: <path d="M11 5v12M6 12l5 5 5-5" />,
  chevronLeft: <path d="M13.5 5.5L8 11l5.5 5.5" />,
  chevronRight: <path d="M8.5 5.5L14 11l-5.5 5.5" />,
  chevronDown: <path d="M5.5 8.5L11 14l5.5-5.5" />,
  scale: (
    <>
      <circle cx="11" cy="12" r="7" />
      <path d="M11 12l3-3.5M8 5.5h6" />
    </>
  ),
  fork: (
    <>
      <path d="M6.5 3v5.5M4 3v3a2.5 2.5 0 0 0 5 0V3M6.5 8.5V19" />
      <path d="M15 3c-1.6 1.2-2.5 3.1-2.5 5.5 0 1.6 1 2.5 2.5 2.5V19" />
    </>
  ),
  leaf: (
    <>
      <path d="M5.5 13.5c0-5.5 4.5-9 12-9.5-.5 7.5-4 11.5-9.5 11.5-1 0-2-.7-2.5-2z" />
      <path d="M4.5 19c2-4.5 5.5-7.5 10-9.5" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 15.5V18h2.5L17 7.5 14.5 5 4 15.5z" />
      <path d="M12.8 6.7l2.5 2.5" />
    </>
  ),
  plus: <path d="M11 5v12M5 11h12" />,
  x: <path d="M6 6l10 10M16 6L6 16" />,
  activity: <path d="M3 11.5h3l2.5-6 4 11.5 2.5-5.5h4" />,
  file: (
    <>
      <path d="M6 3.5h7l4 4V18.5H6z" />
      <path d="M13 3.5v4h4" />
    </>
  ),
  target: (
    <>
      <circle cx="11" cy="11" r="7.5" />
      <circle cx="11" cy="11" r="3.2" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="2" />
      <rect x="12" y="3.5" width="6.5" height="6.5" rx="2" />
      <rect x="3.5" y="12" width="6.5" height="6.5" rx="2" />
      <rect x="12" y="12" width="6.5" height="6.5" rx="2" />
    </>
  ),
  droplet: <path d="M11 3.5C8.2 7 6 9.7 6 12.6a5 5 0 0 0 10 0C16 9.7 13.8 7 11 3.5z" />,
  bolt: <path d="M12.5 3L6.5 12.5h4L9.5 19l6-9.5h-4z" />,
  sliders: (
    <>
      <path d="M19 6.5h-8M12 15.5H3" />
      <circle cx="15.5" cy="15.5" r="2.7" />
      <circle cx="6.5" cy="6.5" r="2.7" />
    </>
  ),
  lock: (
    <>
      <rect x="6" y="10" width="10" height="8" rx="2" />
      <path d="M8 10V7.5a3 3 0 0 1 6 0V10" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5h3l1.5-2h5L15 8.5h3v9H4z" />
      <circle cx="11" cy="12.5" r="3" />
    </>
  ),
  download: <path d="M11 3v11M6.5 9.5L11 14l4.5-4.5M4 18h14" />,
  logout: <path d="M8 3.5H5A1.5 1.5 0 0 0 3.5 5v12A1.5 1.5 0 0 0 5 18.5h3M14.5 15l4-4-4-4M18.5 11H8" />,
  info: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="M11 10v5M11 7v.5" />
    </>
  ),
  ruler: <path d="M3 7.5h16M3 11h16M3 14.5h16M7 4v4M15 10v4" />,
  cycle: (
    <>
      <path d="M18 11a7 7 0 1 1-2.6-5.4" />
      <path d="M18.4 3.4v3.4H15" />
    </>
  ),
  clock: (
    <>
      <circle cx="11" cy="11" r="7.5" />
      <path d="M11 7v4.5l3 1.8" />
    </>
  ),
  trash: (
    <>
      <path d="M4 6.5h14M8.5 6.5V4.5h5v2M6 6.5l.8 11h8.4l.8-11" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="5.5" />
      <path d="M14.5 14.5L18.5 18.5" />
    </>
  ),
};

export function Icon({
  name,
  size = 15,
  strokeWidth = 1.6,
  ...rest
}: { name: IconName; size?: number; strokeWidth?: number } & Omit<
  SVGProps<SVGSVGElement>,
  "width" | "height" | "strokeWidth"
>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
