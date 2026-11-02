"use client";

import { loadLoggedDates } from "@/lib/daily-log-db";
import { createClient } from "@/lib/supabase/client";
import { useUid } from "@/components/UserProvider";
import { addDays, cn, humanDate, parseISODate, todayISO, weekdayHead } from "@/lib/utils";
import {
  stripWeeks,
  weekSpanLabel,
  weeksToCover,
  weekStartOf,
  WEEKS_CHUNK,
} from "@/lib/week-strip";
import { useQueries } from "@tanstack/react-query";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

/** Стеля, щоб гортання назад не росло безкінечно: ~10 років. */
const MAX_WEEKS = WEEKS_CHUNK * 44;

/** Стабільна функція: тоді useQueries віддає той самий масив, поки дані не змінились. */
const allDates = (results: { data?: string[] }[]) => results.flatMap((r) => r.data ?? []);

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Стрічка тижнів Пн–Нд, що гортається вбік: свайп — на тиждень назад чи вперед.
 * Догорнув до найстаршого тижня — стрічка дорендерює ще шматок. Минулі дні
 * клікабельні, майбутні — приглушені й вимкнені (щоденник не пишеться наперед).
 * Крапка під числом — у щоденнику за цей день є рядок.
 */
export function WeekStrip({ date, onSelect }: { date: string; onSelect: (iso: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();
  const today = todayISO();
  const currentWeek = weekStartOf(today);

  // Кількість лише росте: догортання до краю або дата з календаря далеко в минулому.
  const [count, setCount] = useState(WEEKS_CHUNK);
  const total = Math.min(MAX_WEEKS, weeksToCover(count, date, today));
  const weeks = useMemo(() => stripWeeks(today, total), [today, total]);
  const [visibleWeek, setVisibleWeek] = useState(() => weekStartOf(date));

  // Крапки вантажаться шматками по WEEKS_CHUNK тижнів від поточного назад:
  // ключі вже завантажених шматків не міняються, коли зліва додаються нові,
  // а один запит не впирається в ліміт рядків Supabase. Під коренем
  // ["diary", uid]: збереження дня інвалідовує й крапки.
  const chunks = useMemo(() => {
    const out: { from: string; to: string }[] = [];
    for (let end = weeks.length; end > 0; end -= WEEKS_CHUNK) {
      const start = Math.max(0, end - WEEKS_CHUNK);
      out.push({ from: weeks[start], to: addDays(weeks[end - 1], 6) });
    }
    return out;
  }, [weeks]);
  const loggedDates = useQueries({
    queries: chunks.map((c) => ({
      queryKey: ["diary", uid, "logged", c.from, c.to],
      queryFn: () => loadLoggedDates(supabase, uid, c.from, c.to),
    })),
    combine: allDates,
  });
  const logged = useMemo(() => new Set(loggedDates), [loggedDates]);

  const scroller = useRef<HTMLDivElement>(null);
  const shownDate = useRef<string | null>(null);
  const shownLength = useRef(0);

  const scrollToWeek = useCallback(
    (week: string, smooth: boolean) => {
      const el = scroller.current;
      const i = weeks.indexOf(week);
      if (!el || i < 0) return;
      const left = i * el.clientWidth;
      // далекий стрибок (дата з календаря) — без анімації через десятки тижнів
      const near = Math.abs(left - el.scrollLeft) <= el.clientWidth * 1.5;
      el.scrollTo({ left, behavior: smooth && near && !prefersReducedMotion() ? "smooth" : "auto" });
      setVisibleWeek(week);
    },
    [weeks],
  );

  // До рендера кадру: стрічка ніколи не блимає не тим тижнем.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (shownDate.current !== date) {
      // нова вибрана дата — показати її тиждень (на старті — миттєво)
      scrollToWeek(weekStartOf(date), shownDate.current !== null);
      shownDate.current = date;
    } else if (weeks.length > shownLength.current && shownLength.current > 0) {
      // зліва дорендерились старші тижні — тримаємо під пальцем той самий
      el.scrollLeft += (weeks.length - shownLength.current) * el.clientWidth;
    }
    shownLength.current = weeks.length;
  }, [date, weeks, scrollToWeek]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    const week = weeks[Math.min(weeks.length - 1, Math.max(0, i))];
    if (week !== visibleWeek) setVisibleWeek(week);
    // найстарший тиждень у кадрі — дорендерюємо ще шматок
    if (el.scrollLeft < el.clientWidth && total < MAX_WEEKS) {
      setCount(Math.min(MAX_WEEKS, total + WEEKS_CHUNK));
    }
  };

  const awayFromToday = date !== today || visibleWeek !== currentWeek;

  return (
    <div className="flex flex-col gap-[6px]">
      <div className="flex h-[22px] items-center justify-between px-[2px]">
        <span className="text-[12px] font-semibold text-muted" aria-live="polite">
          {weekSpanLabel(visibleWeek)}
        </span>
        {awayFromToday && (
          <button
            type="button"
            onClick={() => (date === today ? scrollToWeek(currentWeek, true) : onSelect(today))}
            className="rounded-full bg-primary-light px-[10px] py-[3px] text-[11px] font-bold text-accent transition active:scale-95"
          >
            Сьогодні
          </button>
        )}
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        role="group"
        aria-label="Дні, гортай убік для інших тижнів"
      >
        {weeks.map((start) => (
          <div key={start} className="flex w-full shrink-0 snap-start snap-always gap-[6px]">
            {Array.from({ length: 7 }, (_, k) => {
              const d = addDays(start, k);
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
                    "flex flex-1 flex-col items-center gap-[2px] rounded-[13px] pb-2 pt-[9px] transition active:scale-95 disabled:active:scale-100",
                    selected
                      ? "bg-accent text-on-accent"
                      : future
                        ? "bg-field text-muted opacity-55"
                        : "bg-surface text-ink",
                  )}
                >
                  <span className="text-[10px] font-medium uppercase tracking-[.05em] opacity-75">
                    {weekdayHead(parseISODate(d).getDay())}
                  </span>
                  <span
                    className={cn(
                      "text-[14px] font-semibold",
                      !selected && d === today && "text-accent",
                    )}
                  >
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
        ))}
      </div>
    </div>
  );
}
