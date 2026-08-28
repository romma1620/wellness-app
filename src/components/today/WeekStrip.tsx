"use client";

import { loadLoggedDates } from "@/lib/daily-log-db";
import { createClient } from "@/lib/supabase/client";
import { useUid } from "@/components/UserProvider";
import { addDays, cn, humanDate, parseISODate, todayISO, weekdayHead } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

/** Понеділок тижня, у якому лежить дата. */
export function weekStartOf(iso: string): string {
  const fromMonday = (parseISODate(iso).getDay() + 6) % 7; // 0=Нд -> 6
  return addDays(iso, -fromMonday);
}

/**
 * Тижнева стрічка Пн–Нд навколо вибраного дня. Минулі дні клікабельні,
 * майбутні — приглушені й вимкнені (щоденник не пишеться наперед).
 * Крапка під числом — у щоденнику за цей день є рядок.
 */
export function WeekStrip({ date, onSelect }: { date: string; onSelect: (iso: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();
  const today = todayISO();
  const start = weekStartOf(date);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);

  // Під коренем ["diary", uid]: збереження дня інвалідовує й крапки.
  const loggedQ = useQuery({
    queryKey: ["diary", uid, "logged", start],
    queryFn: () => loadLoggedDates(supabase, uid, start, addDays(start, 6)),
  });
  const logged = useMemo(() => new Set(loggedQ.data ?? []), [loggedQ.data]);

  return (
    <div className="flex gap-[6px]" role="group" aria-label="Дні тижня">
      {days.map((d) => {
        const selected = d === date;
        const future = d > today;
        const hasLog = logged.has(d);
        return (
          <button
            key={d}
            type="button"
            disabled={future}
            onClick={() => onSelect(d)}
            aria-label={humanDate(d)}
            aria-pressed={selected}
            className={cn(
              "flex flex-1 flex-col items-center gap-[2px] rounded-[13px] border pb-[7px] pt-2 transition active:scale-95 disabled:active:scale-100",
              selected
                ? "border-accent bg-accent text-on-accent"
                : future
                  ? "border-transparent bg-field text-muted opacity-55"
                  : "border-line bg-surface text-ink",
            )}
          >
            <span className="text-[10px] font-medium uppercase tracking-[.05em] opacity-75">
              {weekdayHead(parseISODate(d).getDay())}
            </span>
            <span className={cn("text-[14px] font-semibold", !selected && d === today && "text-accent")}>
              {parseISODate(d).getDate()}
            </span>
            <span
              aria-hidden
              className={cn(
                "h-[3px] w-[3px] rounded-full",
                selected ? "bg-on-accent" : hasLog ? "bg-accent" : "bg-transparent",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
