"use client";

import { Icon } from "@/components/icons";
import { fmt, shortDateAbbr } from "@/lib/utils";
import { prState, type DraftSet, type ExerciseMax } from "@/lib/workouts";

/**
 * Підпис під назвою вправи: історичний максимум ваги, а коли введена вага його
 * перевищує — той самий рядок стає акцентним. Розмір шрифту в обох станах
 * однаковий, тож підходи під ним не стрибають під час набору.
 *
 * Стану «немає даних» не існує: рядок просто не рендериться, бо «—» додало б
 * шуму рівно там, де інформації нема.
 */
export function ExerciseMaxLine({ max, sets }: { max: ExerciseMax | null; sets: DraftSet[] }) {
  const state = prState(max, sets);

  if (state.kind === "none") return null;

  if (state.kind === "beaten") {
    return (
      <div className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-pos">
        <Icon name="arrowUp" size={11} strokeWidth={2} />
        Новий рекорд · +{fmt(state.delta, 1)} кг
      </div>
    );
  }

  return (
    <div className="mt-2 text-[12px] font-medium text-muted">
      Макс {fmt(state.max.weight, 1)} кг × {state.max.reps} · {shortDateAbbr(state.max.date)}
    </div>
  );
}
