"use client";

import { Icon } from "@/components/icons";
import { phaseTint } from "@/components/cycle/tint";
import { Card } from "@/components/ui";
import { PHASE_COLORS, type Phase } from "@/lib/cycle/types";
import { PHASE_TIPS } from "@/lib/cycle/tips";

export function PhaseTipCard({ phase }: { phase: Phase }) {
  const tip = PHASE_TIPS[phase];
  return (
    <Card className="flex gap-[13px]">
      <div
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px]"
        style={{ background: phaseTint(phase), color: PHASE_COLORS[phase] }}
      >
        <Icon name={tip.icon} size={17} strokeWidth={1.6} />
      </div>
      <div>
        <div className="text-[13.5px] font-bold text-ink">{tip.title}</div>
        <div className="mt-1 text-[12.5px] font-normal leading-[1.55] text-muted [text-wrap:pretty]">
          {tip.text}
        </div>
      </div>
    </Card>
  );
}

export function CycleDisclaimer() {
  return (
    <p className="px-3 text-center text-[11px] font-normal leading-[1.5] text-muted [text-wrap:pretty]">
      Прогнози орієнтовні. Це не медичний інструмент і не метод контрацепції.
    </p>
  );
}
