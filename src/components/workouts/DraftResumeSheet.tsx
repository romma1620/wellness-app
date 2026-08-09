"use client";

import { Button, Sheet } from "@/components/ui";
import { draftSummary, type StoredDraft } from "@/lib/workout-draft";

/**
 * Пропозиція продовжити незакінчене тренування. Живе в редакторі, а не на
 * кнопці вкладки: у редактор можна зайти й повз неї — перезавантаженням PWA
 * прямо на /workouts/new, кнопкою «назад», з історії браузера. Тут перевірка
 * одна на всі входи.
 */
export function DraftResumeSheet({
  stored,
  routineName,
  onResume,
  onFresh,
  onCancel,
}: {
  stored: StoredDraft;
  routineName: string | null;
  onResume: () => void;
  onFresh: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet
      open
      onClose={onCancel}
      title="Незакінчене тренування"
      subtitle={draftSummary(stored, routineName)}
    >
      <div className="flex flex-col gap-3">
        <Button type="button" onClick={onResume}>
          Продовжити
        </Button>
        <Button type="button" variant="outline" onClick={onFresh}>
          Почати нове
        </Button>
      </div>
    </Sheet>
  );
}
