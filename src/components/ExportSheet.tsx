"use client";

import { Icon } from "@/components/icons";
import { ErrorBanner, Sheet, Spinner } from "@/components/ui";
import {
  buildExportCsv,
  exportFileName,
  isExportEmpty,
  type ExportRange,
} from "@/lib/csv";
import { loadExportData } from "@/lib/export-db";
import { createClient } from "@/lib/supabase/client";
import { useUid } from "@/components/UserProvider";
import { todayISO } from "@/lib/utils";
import { useMemo, useState } from "react";

const OPTIONS: { value: ExportRange; label: string }[] = [
  { value: "week", label: "За цей тиждень" },
  { value: "month", label: "За цей місяць" },
  { value: "all", label: "За весь час" },
];

function downloadCsv(csv: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Safari ще тримає url у момент кліку — знімаємо наступним тіком.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ExportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();
  const [busy, setBusy] = useState<ExportRange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  async function run(range: ExportRange) {
    setBusy(range);
    setError(null);
    setEmpty(false);
    try {
      const data = await loadExportData(supabase, uid, range);
      if (isExportEmpty(data)) {
        setEmpty(true);
        return; // порожній файл нічого не пояснює — краще сказати прямо
      }

      downloadCsv(buildExportCsv(data), exportFileName(range, todayISO()));
      onClose();
    } catch (err) {
      setError(
        err instanceof Error && err.message === "no-user"
          ? "Сесія завершилась. Онови сторінку."
          : "Не вдалося зібрати файл. Перевір зʼєднання.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Експорт даних в CSV">
      {error && (
        <div className="mb-3">
          <ErrorBanner>{error}</ErrorBanner>
        </div>
      )}
      {empty && (
        <div className="mb-3 flex items-center gap-2 rounded-[13px] bg-primary-light px-4 py-3 text-[13px] font-semibold text-accent">
          <Icon name="info" size={15} strokeWidth={1.8} />
          Немає даних за цей період.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={busy !== null}
            onClick={() => run(o.value)}
            className="flex items-center justify-between gap-3 rounded-[13px] border border-line bg-field px-4 py-[14px] text-left text-[14px] font-semibold text-ink transition active:scale-[.99] disabled:opacity-60 disabled:active:scale-100"
          >
            <span className="flex items-center gap-[10px]">
              <span className="flex text-accent">
                <Icon name="file" size={16} strokeWidth={1.7} />
              </span>
              {o.label}
            </span>
            {busy === o.value ? (
              <Spinner className="h-4 w-4 text-accent" />
            ) : (
              <span className="flex text-muted" aria-hidden>
                <Icon name="chevronRight" size={16} strokeWidth={1.8} />
              </span>
            )}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
