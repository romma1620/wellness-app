"use client";

import { Input, Sheet } from "@/components/ui";
import { MUSCLE_GROUPS } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { UsedExercise } from "@/lib/workouts";
import { useMemo, useState } from "react";

const RECENT_COUNT = 5;

/**
 * Вибір вправи для графіка прогресу.
 *
 * За 50+ вправ хмара чипів займала півекрана над графіком, тож вибір живе
 * в панелі: на екрані лишається один рядок із назвою обраної вправи.
 */
export function ExercisePicker({
  exercises,
  value,
  onChange,
}: {
  exercises: UsedExercise[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = exercises.find((e) => e.id === value);
  const q = query.trim().toLocaleLowerCase("uk");

  const matches = useMemo(
    () => (q ? exercises.filter((e) => e.name.toLocaleLowerCase("uk").includes(q)) : []),
    [exercises, q],
  );

  // Групування рахуємо один раз: воно не залежить від пошуку, бо під час
  // пошуку показується плаский список збігів.
  const sections = useMemo(() => {
    const recent = [...exercises]
      .sort((a, b) => b.lastUsed.localeCompare(a.lastUsed))
      .slice(0, RECENT_COUNT);
    const byGroup = MUSCLE_GROUPS.map((group) => ({
      title: group,
      items: exercises
        .filter((e) => (e.muscleGroup ?? "інше") === group)
        .sort((a, b) => a.name.localeCompare(b.name, "uk")),
    })).filter((s) => s.items.length > 0);
    return recent.length > 0 ? [{ title: "Нещодавні", items: recent }, ...byGroup] : byGroup;
  }, [exercises]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const pick = (id: string) => {
    onChange(id);
    close();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex w-full items-center justify-between gap-2 rounded-[15px] border-[1.5px] border-primary-light bg-surface px-4 py-[13px] text-left transition active:scale-[.99]"
      >
        <span className="truncate text-[15px] font-extrabold text-ink">
          {selected?.name ?? "Вибери вправу"}
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 22 22"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-muted"
          aria-hidden
        >
          <path d="M5 8l6 6 6-6" />
        </svg>
      </button>

      <Sheet open={open} onClose={close} title="Вправа">
        {/* без autoFocus: на мобільному клавіатура зʼїдала б половину панелі */}
        <div className="shrink-0">
          <Input
            value={query}
            placeholder="Пошук вправи"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {/* висоту обмежує Sheet — він єдиний знає, де закінчується видима
            область; тут лишається тільки віддати список під скрол */}
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {q ? (
            matches.length > 0 ? (
              matches.map((e) => (
                <ExerciseRow key={e.id} exercise={e} active={e.id === value} onPick={pick} />
              ))
            ) : (
              <div className="py-6 text-center text-[13px] font-semibold text-muted">
                Нічого не знайшли
              </div>
            )
          ) : (
            sections.map((section) => (
              <div key={section.title}>
                <div className="px-1 pb-1 pt-3 text-[12px] font-bold uppercase text-muted">
                  {section.title}
                </div>
                {section.items.map((e) => (
                  <ExerciseRow key={e.id} exercise={e} active={e.id === value} onPick={pick} />
                ))}
              </div>
            ))
          )}
        </div>
      </Sheet>
    </>
  );
}

function ExerciseRow({
  exercise,
  active,
  onPick,
}: {
  exercise: UsedExercise;
  active: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(exercise.id)}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-[11px] px-3 py-[11px] text-left text-[14px] active:bg-primary-light",
        active ? "font-extrabold text-primary" : "font-semibold text-ink",
      )}
    >
      <span className="truncate">{exercise.name}</span>
      {active && (
        <span aria-hidden className="shrink-0 text-[13px]">
          ✓
        </span>
      )}
    </button>
  );
}
