"use client";

import { Icon } from "@/components/icons";
import { Button, Sheet, Textarea } from "@/components/ui";
import type { Exercise } from "@/lib/types";
import { plural } from "@/lib/utils";
import { parsedSummary, parseWorkoutText, type ParsedExercise } from "@/lib/workout-parse";
import { useMemo, useState } from "react";

const PLACEHOLDER = `Румунська тяга 60 кг 4 х 10
Випади 7 кг 3 х 12
Підтягування 3 х 6 (швидко догори)`;

/**
 * Введення тренування текстом: вставляється все тренування цілком. Розбір живий — під полем
 * одразу видно, що розпізналось, а що ні, і додається лише розпізнане.
 * Ручний редактор нікуди не дівається: вправи падають у нього звичайними
 * картками, які можна правити далі.
 */
export function PasteWorkoutSheet({
  exercises,
  onApply,
  onClose,
}: {
  exercises: Exercise[];
  onApply: (parsed: ParsedExercise[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const result = useMemo(() => parseWorkoutText(text), [text]);
  const known = useMemo(
    () => new Set(exercises.map((e) => e.name.trim().toLowerCase())),
    [exercises],
  );
  const count = result.exercises.length;

  return (
    <Sheet
      open
      onClose={onClose}
      title="Вставити текстом"
      subtitle="Встав усе тренування — розберемо його на вправи"
    >
      <div className="flex flex-col gap-3">
        <Textarea
          rows={7}
          autoFocus
          placeholder={PLACEHOLDER}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Тренування текстом"
        />

        {(count > 0 || result.skipped.length > 0) && (
          <div className="flex flex-col gap-[6px]">
            {result.exercises.map((p, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-3 rounded-[11px] bg-field px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-semibold text-ink">{p.name}</div>
                  {p.note && (
                    <div className="truncate text-[11.5px] font-medium text-muted">{p.note}</div>
                  )}
                  {!known.has(p.name.trim().toLowerCase()) && (
                    <div className="text-[11px] font-semibold text-accent">нова вправа</div>
                  )}
                </div>
                <div className="shrink-0 text-[12.5px] font-semibold tabular-nums text-muted">
                  {parsedSummary(p)}
                </div>
              </div>
            ))}
            {result.skipped.map((line, i) => (
              <div
                key={`s${i}`}
                className="flex items-center gap-2 rounded-[11px] px-3 py-[6px] text-[12px] font-medium text-neg"
              >
                <Icon name="info" size={12} strokeWidth={1.8} />
                <span className="min-w-0 truncate">Не розпізнано: {line}</span>
              </div>
            ))}
          </div>
        )}

        <Button type="button" disabled={count === 0} onClick={() => onApply(result.exercises)}>
          {count > 0 ? `Додати ${count} ${plural(count, "вправу", "вправи", "вправ")}` : "Додати"}
        </Button>
      </div>
    </Sheet>
  );
}
