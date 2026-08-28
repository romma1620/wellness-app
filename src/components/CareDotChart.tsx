"use client";

import type { CareRow } from "@/lib/care";
import { parseISODate, shortDate } from "@/lib/utils";
import { Fragment, useState } from "react";

const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

/** Підписуємо 1-ше число й кожне пʼяте — інакше на телефоні підписи злипаються. */
function axisLabel(iso: string, weekMode: boolean): string {
  const d = parseISODate(iso);
  if (weekMode) return WD[(d.getDay() + 6) % 7];
  const day = d.getDate();
  return day === 1 || day % 5 === 0 ? String(day) : "";
}

export function CareDotChart({ rows, dates }: { rows: CareRow[]; dates: string[] }) {
  const [active, setActive] = useState<{ key: string; iso: string } | null>(null);

  if (rows.length === 0) {
    return (
      <div className="py-6 text-center text-[12px] font-medium text-muted">
        Ще немає доглядів за цей період
      </div>
    );
  }

  const weekMode = dates.length <= 7;
  // 9px крапки з дизайну — для тижня; у місяці 30 колонок, тож дрібніші.
  const dot = weekMode ? 9 : 6;
  const activeRow = active ? rows.find((r) => r.key === active.key) : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1.5">
        {rows.map((row) => (
          <span
            key={row.key}
            className="flex items-center gap-[6px] text-[11px] font-medium text-muted"
          >
            <span
              className="h-[9px] w-[9px] shrink-0 rounded-full"
              style={{ background: row.color }}
            />
            {row.label}
          </span>
        ))}
      </div>

      <div
        className="grid items-center gap-y-[2px]"
        style={{ gridTemplateColumns: `64px repeat(${dates.length}, minmax(0, 1fr)) 22px` }}
      >
        {rows.map((row) => (
          <Fragment key={row.key}>
            <div className="truncate pr-1.5 text-[11px] font-semibold text-ink">{row.label}</div>
            {dates.map((iso, i) => {
              const on = row.days[i] ?? false;
              const isActive = active?.key === row.key && active.iso === iso;
              return on ? (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setActive({ key: row.key, iso })}
                  aria-label={`${row.label}, ${shortDate(iso)}`}
                  aria-pressed={isActive}
                  className="flex h-6 items-center justify-center"
                >
                  <span
                    className="rounded-full transition-transform"
                    style={{
                      width: dot,
                      height: dot,
                      background: row.color,
                      transform: isActive ? "scale(1.35)" : undefined,
                    }}
                  />
                </button>
              ) : (
                <span key={iso} className="flex h-6 items-center justify-center">
                  <span
                    className="rounded-full bg-line"
                    style={{ width: 3, height: 3 }}
                  />
                </span>
              );
            })}
            <div className="pl-1 text-right text-[10.5px] font-semibold text-muted">
              {row.count}
            </div>
          </Fragment>
        ))}

        <div />
        {dates.map((iso) => (
          <div
            key={iso}
            className="pt-1 text-center text-[9.5px] font-semibold leading-none text-muted"
          >
            {axisLabel(iso, weekMode)}
          </div>
        ))}
        <div />
      </div>

      <div className="mt-2 h-4 text-center text-[11px] font-medium text-muted">
        {active && activeRow ? `${shortDate(active.iso)} · ${activeRow.label}` : ""}
      </div>
    </div>
  );
}
