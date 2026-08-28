"use client";

import { Icon } from "@/components/icons";
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
    // не Card: «Відкинути» йде окремим рядком впритул до країв, а Card має відступ
    <div className="overflow-hidden rounded-xl2 border border-line bg-surface">
      <Link
        href="/workouts/new"
        className="flex items-center gap-3 px-[18px] py-[13px] text-ink transition active:bg-field"
      >
        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px] bg-primary-light text-accent">
          <Icon name="clock" size={17} strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold">Незакінчене тренування</div>
          <div className="mt-[2px] truncate text-[11.5px] font-normal text-muted">
            {draftSummary(stored)}
          </div>
        </div>
        <span aria-hidden className="shrink-0 text-muted">
          <Icon name="chevronRight" size={16} strokeWidth={1.8} />
        </span>
      </Link>
      <button
        type="button"
        onClick={onDiscard}
        className="w-full border-t border-line py-[10px] text-[12px] font-semibold text-muted transition active:bg-field"
      >
        Відкинути
      </button>
    </div>
  );
}
