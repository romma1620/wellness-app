"use client";

import { Icon } from "@/components/icons";
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
    <div className="flex flex-col gap-[14px]">
      {groups.map((group) => {
        const total = totalOf.get(group.month);
        return (
          // не Card: рядки йдуть впритул до країв, а Card має вбудований відступ
          <div key={group.month} className="overflow-hidden rounded-xl2 bg-surface">
            <div className="flex items-baseline justify-between px-[18px] pb-[10px] pt-4">
              <div className="text-[14.5px] font-bold text-ink">{monthLabel(group.month)}</div>
              {total && (
                <div className="text-[11.5px] font-medium text-muted">
                  {total.sessions} {plural(total.sessions, "сесія", "сесії", "сесій")} ·{" "}
                  {fmtThousands(total.tonnage)} т
                </div>
              )}
            </div>
            {group.items.map((w) => (
              <Link
                key={w.id}
                href={`/workouts/${w.id}`}
                className="flex items-center gap-3 border-t border-line px-[18px] py-3 text-ink transition active:bg-field"
              >
                <div className="flex h-[44px] w-[40px] shrink-0 flex-col items-center justify-center rounded-[11px] border border-line bg-field">
                  <div className="text-[14px] font-bold leading-[1.2]">
                    {parseISODate(w.date).getDate()}
                  </div>
                  <div className="text-[9.5px] font-medium leading-[1.2] text-muted">
                    {weekdayShort(w.date)}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold">
                    {w.name ?? "Тренування"}
                  </div>
                  <div className="mt-[2px] text-[11.5px] font-normal text-muted">
                    {w.exerciseCount} {plural(w.exerciseCount, "вправа", "вправи", "вправ")}
                  </div>
                </div>
                <span aria-hidden className="shrink-0 text-muted">
                  <Icon name="chevronRight" size={16} strokeWidth={1.8} />
                </span>
              </Link>
            ))}
          </div>
        );
      })}

      {remaining > 0 && (
        <Button
          variant="outline"
          className="border-transparent"
          loading={loadingMore}
          onClick={onLoadMore}
        >
          Показати ще · лишилось {remaining}
        </Button>
      )}
    </div>
  );
}
