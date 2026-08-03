"use client";

import { Button } from "@/components/ui";
import { fmtThousands, monthLabel, parseISODate, plural, weekdayShort } from "@/lib/utils";
import { groupByMonth, type MonthTotal, type WorkoutListItem } from "@/lib/workouts";
import Link from "next/link";

/**
 * Архів сесій, згрупований за календарними місяцями.
 *
 * Тоннаж живе тільки в заголовку групи: у рядку він конкурував би за місце
 * з назвою тренування, а місячний підсумок і так приходить готовим із бази.
 */
export function WorkoutList({
  items,
  totals,
  remaining,
  loadingMore,
  onLoadMore,
}: {
  items: WorkoutListItem[];
  totals: MonthTotal[];
  remaining: number;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const groups = groupByMonth(items);
  const totalOf = new Map(totals.map((t) => [t.month, t]));

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const total = totalOf.get(group.month);
        return (
          // не Card: рядки йдуть впритул до країв, а Card має вбудований p-4
          <div key={group.month} className="overflow-hidden rounded-xl2 bg-surface shadow-card">
            <div className="px-4 pb-2 pt-4">
              <div className="text-[15px] font-extrabold text-ink">{monthLabel(group.month)}</div>
              {total && (
                <div className="mt-0.5 text-[12px] font-semibold text-muted">
                  {total.sessions} {plural(total.sessions, "сесія", "сесії", "сесій")} ·{" "}
                  {fmtThousands(total.tonnage)} т
                </div>
              )}
            </div>
            {group.items.map((w) => (
              <Link
                key={w.id}
                href={`/workouts/${w.id}`}
                className="flex items-center gap-3 border-t border-primary-light px-4 py-[11px] transition active:bg-primary-light"
              >
                <div className="w-[34px] shrink-0 text-center">
                  <div className="text-[15px] font-extrabold leading-tight text-ink">
                    {parseISODate(w.date).getDate()}
                  </div>
                  <div className="text-[11px] font-semibold leading-tight text-muted">
                    {weekdayShort(w.date)}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-extrabold text-ink">
                    {w.name ?? "Тренування"}
                  </div>
                  <div className="text-[12px] font-semibold text-muted">
                    {w.exerciseCount} {plural(w.exerciseCount, "вправа", "вправи", "вправ")}
                  </div>
                </div>
                <span aria-hidden className="shrink-0 text-[16px] font-bold text-muted">
                  ›
                </span>
              </Link>
            ))}
          </div>
        );
      })}

      {remaining > 0 && (
        <Button variant="outline" loading={loadingMore} onClick={onLoadMore}>
          Показати ще · лишилось {remaining}
        </Button>
      )}
    </div>
  );
}
