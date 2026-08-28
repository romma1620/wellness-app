"use client";

import { Icon } from "@/components/icons";
import { useDecimalBuffer } from "@/components/inputs";
import { Input } from "@/components/ui";
import type { DraftSet } from "@/lib/workouts";

export function SetRow({
  index,
  set,
  onChange,
  onRemove,
}: {
  index: number;
  set: DraftSet;
  onChange: (next: DraftSet) => void;
  onRemove: () => void;
}) {
  const weight = useDecimalBuffer(set.weight, (v) => onChange({ ...set, weight: v }), { min: 0, max: 999 });
  const reps = useDecimalBuffer(set.reps, (v) => onChange({ ...set, reps: v }), { min: 0, max: 999 });

  return (
    <div className="flex items-center gap-2">
      <div className="flex w-5 shrink-0 items-center justify-center text-[12px] font-semibold text-muted">
        {index + 1}
      </div>
      <div className="flex-1">
        <Input placeholder="вага" suffix="кг" {...weight.inputProps} />
      </div>
      <div className="flex-1">
        <Input placeholder="повтори" suffix="×" {...reps.inputProps} />
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Прибрати підхід"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition active:scale-90"
      >
        <Icon name="x" size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
