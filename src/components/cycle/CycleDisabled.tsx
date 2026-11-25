"use client";

import { phaseTint } from "@/components/cycle/tint";
import { Icon } from "@/components/icons";
import { Button, ErrorBanner, PageTitle } from "@/components/ui";
import { PHASE_COLORS } from "@/lib/cycle/types";
import { plural } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";

/**
 * Екран вимкненої фічі.
 *
 * Свідомо НЕ онбординг: онбординг питає дату останньої менструації й пише
 * її в базу, тож повторне ввімкнення через нього дописувало б фантомний
 * перший день менструації і ламало derivation. Тут є лише перемикач —
 * записи вже лежать у базі й чекають.
 */
export function CycleDisabled({
  entryCount,
  onEnable,
}: {
  entryCount: number;
  onEnable: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      await onEnable();
    } catch {
      setError("Не вдалося увімкнути трекінг. Перевір зʼєднання.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-[16px]">
      <PageTitle>Цикл</PageTitle>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div
        className="flex flex-col items-center rounded-xl2 px-5 pb-6 pt-[24px] text-center"
        style={{
          background: `linear-gradient(140deg, ${phaseTint("menstrual")} 0%, var(--surface) 65%)`,
        }}
      >
        <div
          className="flex h-14 w-14 items-center justify-center rounded-[20px]"
          style={{ background: phaseTint("menstrual"), color: PHASE_COLORS.menstrual }}
        >
          <Icon name="cycle" size={26} />
        </div>
        <div className="mt-4 text-[20px] font-medium text-ink">Трекінг циклу вимкнено</div>
        <div className="mt-[8px] text-[13px] font-normal leading-[1.55] text-muted [text-wrap:pretty]">
          {entryCount > 0
            ? `Твої записи на місці — ${entryCount} ${plural(entryCount, "день", "дні", "днів")}. Увімкни, щоб знову бачити фазу, прогноз і фази в аналітиці.`
            : "Увімкни, щоб знову бачити календар, фазу й прогноз."}
        </div>
      </div>

      <Button type="button" onClick={enable} loading={busy}>
        Увімкнути трекінг циклу
      </Button>

      <Link
        href="/settings/cycle"
        className="pb-2 text-center text-[13px] font-medium text-muted"
      >
        Налаштування й видалення даних
      </Link>
    </div>
  );
}
