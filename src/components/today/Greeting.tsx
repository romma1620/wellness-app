"use client";

import { OriMessage } from "@/components/Ori";
import { greetingFor } from "@/lib/greeting";
import { useSyncExternalStore } from "react";

/** Хвилинного тіка досить: межа періоду зрушить привітання щонайбільше на хвилину. */
function subscribeClock(cb: () => void) {
  const id = setInterval(cb, 60_000);
  document.addEventListener("visibilitychange", cb); // повернення до застосунку вранці
  return () => {
    clearInterval(id);
    document.removeEventListener("visibilitychange", cb);
  };
}

// Знімок — примітив (день·100 + година), щоб useSyncExternalStore не
// перерендерював щохвилини даремно: змінюється лише коли міняється година.
const readClock = () => {
  const d = new Date();
  return d.getDate() * 100 + d.getHours();
};
// Сервер не знає годину юзера — рендеримо порожнє місце тієї ж висоти.
const serverClock = () => -1;

/** Шапка «Сьогодні»: Орі й привітання за локальним часом юзера. */
export function Greeting() {
  const clock = useSyncExternalStore(subscribeClock, readClock, serverClock);

  if (clock < 0) return <div className="h-16" aria-hidden />;

  const g = greetingFor(clock % 100, Math.floor(clock / 100));
  return <OriMessage pose={g.pose} title={g.title} text={g.line} className="h-16 px-[2px]" />;
}
