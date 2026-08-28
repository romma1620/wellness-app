"use client";

import { Icon } from "@/components/icons";
import { usePhaseOverlay } from "@/components/cycle/analytics";
import { PHASE_COLORS, PHASE_LABELS } from "@/lib/cycle/types";
import Link from "next/link";

/**
 * Рядок «День циклу N · фаза» під вагою — посилання на екран циклу.
 * Дані ті самі, що в накладці аналітики (спільний кеш ["cycle", uid, "overlay"]).
 * Рядка нема, поки цикл не ввімкнено або фаза для цього дня невідома.
 */
export function CycleRow({ date }: { date: string }) {
  const overlay = usePhaseOverlay();
  if (!overlay.available) return null;
  const phase = overlay.phaseFor(date);
  const day = overlay.cycleDayFor(date);
  if (!phase || day === null) return null;

  return (
    <Link
      href="/cycle"
      className="mt-[14px] flex w-full items-center gap-2 border-t border-line pt-3 text-left text-ink"
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: PHASE_COLORS[phase] }}
      />
      <span className="text-[12px] font-semibold">
        День циклу {day}{" "}
        <span className="font-normal text-muted">· {PHASE_LABELS[phase].toLowerCase()}</span>
      </span>
      <span className="ml-auto flex text-muted">
        <Icon name="chevronRight" size={14} strokeWidth={1.8} />
      </span>
    </Link>
  );
}
