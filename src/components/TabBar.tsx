"use client";

import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Сьогодні", icon: "calendar" },
  { href: "/analytics", label: "Аналітика", icon: "bars" },
  { href: "/workouts", label: "Тренування", icon: "dumbbell" },
  { href: "/insights", label: "Інсайти", icon: "bulb" },
  { href: "/settings", label: "Профіль", icon: "user" },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center">
      <div className="w-full max-w-app px-[14px] pb-[calc(env(safe-area-inset-bottom)+18px)]">
        <div className="pointer-events-auto flex items-center rounded-full border border-line bg-surface p-[5px] shadow-up">
          {TABS.map((t) => {
            const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                aria-label={t.label}
                className={cn(
                  "flex h-[46px] basis-0 items-center justify-center rounded-full transition-[flex-grow,background-color,color] duration-300 motion-reduce:transition-none",
                  active ? "grow-[2.6] bg-primary-light text-accent" : "grow text-muted",
                )}
              >
                <Icon name={t.icon} size={21} strokeWidth={1.7} />
                <span
                  className={cn(
                    "overflow-hidden whitespace-nowrap text-[11px] font-bold transition-[max-width,margin-left,opacity] duration-300 motion-reduce:transition-none",
                    active ? "ml-[7px] max-w-[96px] opacity-100" : "ml-0 max-w-0 opacity-0",
                  )}
                >
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
