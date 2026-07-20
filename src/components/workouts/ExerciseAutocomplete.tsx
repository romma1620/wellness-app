"use client";

import { Input } from "@/components/ui";
import type { Exercise, MuscleGroup } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

export interface ExercisePick {
  name: string;
  exerciseId: string | null;
  muscleGroup: MuscleGroup | null;
}

export function ExerciseAutocomplete({
  value,
  exercises,
  onPick,
  placeholder = "Назва вправи",
}: {
  value: string;
  exerciseId: string | null;
  exercises: Exercise[];
  onPick: (next: ExercisePick) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!q) return exercises.slice(0, 8);
    return exercises.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 8);
  }, [exercises, q]);

  const exactExists = exercises.some((e) => e.name.trim().toLowerCase() === q);

  return (
    <div className="relative">
      <Input
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          // друкуючи, вважаємо це новою/незв'язаною назвою, доки не оберуть зі списку
          onPick({ name: e.target.value, exerciseId: null, muscleGroup: null });
          setOpen(true);
        }}
      />
      {open && (matches.length > 0 || (q && !exactExists)) && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-[15px] border-[1.5px] border-primary-light bg-surface p-1 shadow-card">
          {matches.map((e) => (
            <button
              key={e.id}
              type="button"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => {
                onPick({ name: e.name, exerciseId: e.id, muscleGroup: e.muscle_group });
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-[11px] px-3 py-2 text-left text-[14px] font-semibold text-ink active:bg-primary-light"
            >
              <span>{e.name}</span>
              {e.muscle_group && (
                <span className="text-[11px] font-bold text-muted">{e.muscle_group}</span>
              )}
            </button>
          ))}
          {q && !exactExists && (
            <div
              className={cn(
                "px-3 py-2 text-[12.5px] font-bold text-primary",
                matches.length > 0 && "border-t border-primary-light",
              )}
            >
              + додасться нова вправа «{value.trim()}»
            </div>
          )}
        </div>
      )}
    </div>
  );
}
