"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const ICON_PROPS = {
  width: 23,
  height: 23,
  viewBox: "0 0 22 22",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const TABS: { href: string; label: string; icon: ReactNode }[] = [
  {
    href: "/",
    label: "Сьогодні",
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="4.5" width="16" height="15" rx="3.5" />
        <path d="M3 9h16M7 2.5v3M15 2.5v3" />
      </svg>
    ),
  },
  {
    href: "/analytics",
    label: "Аналітика",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M3.5 18.5h15" />
        <path d="M6 15v-4" />
        <path d="M11 15V6" />
        <path d="M16 15v-6" />
      </svg>
    ),
  },
  {
    href: "/workouts",
    label: "Тренування",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 8.5v5M18 8.5v5M6.5 7v8M15.5 7v8M6.5 11h9" />
      </svg>
    ),
  },
  {
    href: "/insights",
    label: "Інсайти",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M11 3a5.6 5.6 0 0 1 3.2 10.2c-.7.5-1.2 1.2-1.2 2v.3H9v-.3c0-.8-.5-1.5-1.2-2A5.6 5.6 0 0 1 11 3z" />
        <path d="M9.2 19h3.6" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Профіль",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="11" cy="8" r="3.6" />
        <path d="M4.5 18.5a6.5 6.5 0 0 1 13 0" />
      </svg>
    ),
  },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center">
      <div className="w-full max-w-app bg-surface px-1.5 pb-[env(safe-area-inset-bottom)] pt-3 shadow-[0_-6px_22px_-12px_var(--shadow-up)]">
        <div className="flex items-start justify-around pb-2">
          {TABS.map((t) => {
            const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "flex w-16 flex-col items-center gap-[5px] transition-colors",
                  active ? "text-primary" : "text-muted",
                )}
              >
                {t.icon}
                <span className={cn("text-[10.5px]", active ? "font-extrabold" : "font-semibold")}>
                  {t.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
