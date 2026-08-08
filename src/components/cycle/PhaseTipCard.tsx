"use client";

import { PHASE_TINTS, type Phase } from "@/lib/cycle/types";
import { PHASE_TIPS } from "@/lib/cycle/tips";

export function PhaseTipCard({ phase }: { phase: Phase }) {
  const tip = PHASE_TIPS[phase];
  return (
    <div className="flex gap-[13px] rounded-xl2 bg-surface p-4 shadow-card">
      <div
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[13px] text-[19px]"
        style={{ background: PHASE_TINTS[phase] }}
      >
        {tip.emoji}
      </div>
      <div>
        <div className="text-[14px] font-extrabold">{tip.title}</div>
        <div className="mt-1 text-[13px] font-semibold leading-[1.5] text-muted [text-wrap:pretty]">
          {tip.text}
        </div>
      </div>
    </div>
  );
}

export function CycleDisclaimer() {
  return (
    <p className="px-3 text-center text-[11.5px] font-semibold leading-[1.5] text-muted [text-wrap:pretty]">
      Прогнози орієнтовні. Це не медичний інструмент і не метод контрацепції.
    </p>
  );
}
