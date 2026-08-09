"use client";

import { draftSummary, type StoredDraft } from "@/lib/workout-draft";
import Link from "next/link";

/**
 * Незбережене тренування над архівом. Назви шаблону не показує: сторінка
 * «Тренування» не вантажить `routines`, а окремий запит заради одного
 * підпису того не вартий — шаблон буде видно в шіті вже в редакторі.
 */
export function UnfinishedWorkoutCard({
  stored,
  onDiscard,
}: {
  stored: StoredDraft;
  onDiscard: () => void;
}) {
  return (
    // не Card: «Відкинути» йде окремим рядком впритул до країв, а Card має p-4
    <div className="overflow-hidden rounded-xl2 border-[1.5px] border-primary-light bg-surface shadow-card">
      <Link
        href="/workouts/new"
        className="flex items-center gap-3 px-4 py-[13px] transition active:bg-primary-light"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-extrabold text-ink">Незакінчене тренування</div>
          <div className="truncate text-[12px] font-semibold text-muted">
            {draftSummary(stored)}
          </div>
        </div>
        <span aria-hidden className="shrink-0 text-[16px] font-bold text-muted">
          ›
        </span>
      </Link>
      <button
        type="button"
        onClick={onDiscard}
        className="w-full border-t border-primary-light py-[10px] text-[12.5px] font-bold text-muted transition active:bg-primary-light"
      >
        Відкинути
      </button>
    </div>
  );
}
