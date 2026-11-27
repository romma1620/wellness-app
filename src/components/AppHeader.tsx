"use client";

import { Icon } from "@/components/icons";
import { useTheme } from "@/components/ThemeProvider";
import { resolveMode } from "@/lib/theme-mode";
import { useSyncExternalStore } from "react";

function subscribeSystem(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const readSystemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

/**
 * Шапка кожного екрана: вордмарк «aura» та швидкий перемикач світла/темна.
 * Перемикач завжди ставить явний режим (не «Система»): натискання має дати
 * передбачуваний результат, а не залежати від того, що зараз у пристрої.
 */
export function AppHeader() {
  const { mode, setMode } = useTheme();
  const systemDark = useSyncExternalStore(subscribeSystem, readSystemDark, () => true);
  const resolved = resolveMode(mode, systemDark);

  return (
    <div className="flex items-center justify-between px-1 py-[2px]">
      <div className="flex items-center gap-[7px]">
        <span className="text-[13px] font-bold uppercase tracking-[.3em]">aura</span>
        <span className="h-[5px] w-[5px] rounded-full bg-accent" />
      </div>
      <button
        type="button"
        onClick={() => setMode(resolved === "dark" ? "light" : "dark")}
        aria-label={resolved === "dark" ? "Увімкнути світлу тему" : "Увімкнути темну тему"}
        className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-line bg-surface text-muted active:scale-95"
      >
        <Icon name={resolved === "dark" ? "sun" : "moon"} size={16} strokeWidth={1.7} />
      </button>
    </div>
  );
}
