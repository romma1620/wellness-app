"use client";

import { Button, ErrorBanner } from "@/components/ui";
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
    <div className="flex flex-col gap-[15px]">
      <h1 className="px-1 pt-1 text-[22px] font-extrabold">Цикл</h1>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div
        className="flex flex-col items-center rounded-xl2 px-5 pb-6 pt-[22px] text-center"
        style={{ background: "linear-gradient(135deg, #FBE2E8 0%, var(--primary-light) 100%)" }}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/75">
          <svg
            width="30"
            height="30"
            viewBox="0 0 22 22"
            fill="none"
            stroke="#C05B71"
            strokeWidth={1.9}
            strokeLinecap="round"
          >
            <path d="M18 11a7 7 0 1 1-2.6-5.4" />
            <path d="M18.4 3.4v3.4H15" />
          </svg>
        </div>
        <div className="mt-3.5 text-[19px] font-extrabold">Трекінг циклу вимкнено</div>
        <div className="mt-[7px] text-[13.5px] font-semibold leading-[1.5] text-muted [text-wrap:pretty]">
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
        className="pb-2 text-center text-[13px] font-bold text-muted"
      >
        Налаштування й видалення даних
      </Link>
    </div>
  );
}
