"use client";

import { MUSCLE_GROUPS, type MuscleGroup } from "@/lib/types";

/**
 * Вибір м'язової групи для вправи, якої ще немає в довіднику.
 * Повторний тап знімає вибір: група необов'язкова, без неї вправа
 * впаде в «інше» на балансі груп.
 */
export function MuscleGroupChips({
  value,
  onChange,
}: {
  value: MuscleGroup | null;
  onChange: (g: MuscleGroup | null) => void;
}) {
  return (
    <div className="mt-2">
      <div className="mb-1.5 text-[11.5px] font-bold text-muted">{"Група м'язів нової вправи"}</div>
      <div className="flex flex-wrap gap-1.5">
        {MUSCLE_GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onChange(value === g ? null : g)}
            className={
              value === g
                ? "rounded-full bg-primary px-3 py-[7px] text-[12px] font-bold text-white"
                : "rounded-full border-[1.5px] border-primary-light bg-bg px-3 py-[7px] text-[12px] font-semibold text-muted"
            }
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  );
}
