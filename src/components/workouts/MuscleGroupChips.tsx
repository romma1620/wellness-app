"use client";

import { Chip, FieldLabel } from "@/components/ui";
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
    <div className="mt-[10px]">
      <FieldLabel>{"Група м'язів нової вправи"}</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {MUSCLE_GROUPS.map((g) => (
          <Chip key={g} active={value === g} onClick={() => onChange(value === g ? null : g)}>
            {g}
          </Chip>
        ))}
      </div>
    </div>
  );
}
