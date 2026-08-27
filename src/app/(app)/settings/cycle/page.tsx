"use client";

import { CycleDisclaimer } from "@/components/cycle/PhaseTipCard";
import { Button, Card, ErrorBanner, FullLoader, Sheet, Toggle } from "@/components/ui";
import {
  deleteAllCycleData,
  loadCycleEntries,
  loadCycleSettings,
  saveCycleSettings,
} from "@/lib/cycle-db";
import { cycleDayFor, deriveCycles } from "@/lib/cycle/derive";
import {
  CYCLE_LENGTH_MAX,
  CYCLE_LENGTH_MIN,
  FLOW_LABELS,
  MOOD_LABELS,
  symptomLabel,
  type CycleSettings,
} from "@/lib/cycle/types";
import { buildCycleCsv, cycleExportFileName, type CycleCsvRow } from "@/lib/csv";
import { createClient } from "@/lib/supabase/client";
import { useUid } from "@/components/UserProvider";
import { cn, todayISO } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const PERIOD_MIN = 1;
const PERIOD_MAX = 12;

function downloadCsv(csv: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Число зі кроком ±1. Слайдер тут був би завеликим для одного рядка списку. */
function Stepper({
  value,
  min,
  max,
  suffix,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  suffix: string;
  label: string;
  onChange: (v: number) => void;
}) {
  const btn =
    "flex h-7 w-7 items-center justify-center rounded-full bg-primary-light text-primary transition active:scale-90 disabled:opacity-30 disabled:active:scale-100";
  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        className={btn}
        disabled={value <= min}
        aria-label={`${label}: менше`}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={15} />
      </button>
      <span className="min-w-[54px] text-center text-[15px] font-extrabold">
        {value} {suffix}
      </span>
      <button
        type="button"
        className={btn}
        disabled={value >= max}
        aria-label={`${label}: більше`}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

function Row({
  title,
  subtitle,
  control,
  last,
}: {
  title: string;
  subtitle?: string;
  control: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 py-[15px]",
        !last && "border-b-[1.5px] border-bg",
      )}
    >
      <div className="min-w-0">
        <div className="text-[14px] font-bold text-muted">{title}</div>
        {subtitle && (
          <div className="mt-0.5 text-[12px] font-semibold text-muted opacity-80">{subtitle}</div>
        )}
      </div>
      {control}
    </div>
  );
}

export default function CycleSettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const settingsKey = useMemo(() => ["cycle", uid, "settings"] as const, [uid]);
  const settingsQ = useQuery({
    queryKey: settingsKey,
    queryFn: async () => (await loadCycleSettings(supabase, uid)).settings,
  });
  const settings = settingsQ.data ?? null;
  const loading = settingsQ.isPending;
  const error =
    actionError ?? (settingsQ.isError ? "Не вдалося завантажити налаштування." : null);

  /**
   * Оптимістично: перемикач мусить відповідати на тап одразу. Якщо запис
   * не пройшов — повертаємо попереднє значення, щоб на екрані не лишався
   * стан, якого в базі немає.
   */
  async function patch(next: Partial<Omit<CycleSettings, "user_id">>) {
    if (!settings) return;
    const prev = settings;
    queryClient.setQueryData<CycleSettings>(settingsKey, { ...settings, ...next });
    setActionError(null);
    try {
      await saveCycleSettings(supabase, uid, next);
      // ці ж налаштування читають календар циклу й накладка в аналітиці
      void queryClient.invalidateQueries({ queryKey: ["cycle", uid], refetchType: "none" });
    } catch {
      queryClient.setQueryData<CycleSettings>(settingsKey, prev);
      setActionError("Не вдалося зберегти. Перевір зʼєднання.");
    }
  }

  async function exportCsv() {
    setBusy("export");
    setActionError(null);
    try {
      const entries = await loadCycleEntries(supabase, uid, "1970-01-01", todayISO());
      if (entries.length === 0) {
        setActionError("Записів циклу ще немає — експортувати нічого.");
        return;
      }
      const cycles = deriveCycles(entries.map((e) => ({ date: e.date, flow: e.flow })));
      const rows: CycleCsvRow[] = entries.map((e) => ({
        date: e.date,
        cycleDay: cycleDayFor(e.date, cycles),
        flow: e.flow ? FLOW_LABELS[e.flow] : null,
        symptoms: (e.symptoms ?? []).map(symptomLabel).join(", "),
        mood: e.mood ? MOOD_LABELS[e.mood] : null,
        energy: e.energy,
        notes: e.notes,
      }));
      downloadCsv(buildCycleCsv(rows), cycleExportFileName(todayISO()));
    } catch {
      setActionError("Не вдалося зібрати файл. Перевір зʼєднання.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteAll() {
    setBusy("delete");
    setActionError(null);
    try {
      await deleteAllCycleData(supabase, uid);
      // зникли і записи, і налаштування — все, що на них дивиться, застаріло
      await queryClient.invalidateQueries({ queryKey: ["cycle", uid] });
      await queryClient.invalidateQueries({ queryKey: ["diary", uid] });
      setConfirmOpen(false);
    } catch {
      setActionError("Не вдалося видалити дані. Спробуй ще раз.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-[15px]">
      <div className="flex items-center gap-3 px-0 pt-1">
        <Link
          href="/settings"
          aria-label="Назад до профілю"
          className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-surface text-muted shadow-soft active:scale-95"
        >
          <ChevronLeft size={19} />
        </Link>
        <h1 className="text-[22px] font-extrabold">Цикл</h1>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {loading || !settings ? (
        <FullLoader />
      ) : (
        <>
          <Card className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[14.5px] font-extrabold">Трекінг циклу</div>
              <div className="mt-0.5 text-[12px] font-semibold text-muted">
                вкладка «Цикл» і фази в аналітиці
              </div>
            </div>
            <Toggle
              label="Трекінг циклу"
              checked={settings.enabled}
              onChange={(v) => patch({ enabled: v })}
            />
          </Card>

          <Card className="!py-0">
            <Row
              title="Типова довжина циклу"
              control={
                <Stepper
                  label="Типова довжина циклу"
                  value={settings.typical_cycle_length}
                  min={CYCLE_LENGTH_MIN}
                  max={CYCLE_LENGTH_MAX}
                  suffix="дн."
                  onChange={(v) => patch({ typical_cycle_length: v })}
                />
              }
            />
            <Row
              title="Тривалість менструації"
              control={
                <Stepper
                  label="Тривалість менструації"
                  value={settings.typical_period_length}
                  min={PERIOD_MIN}
                  max={PERIOD_MAX}
                  suffix="дн."
                  onChange={(v) => patch({ typical_period_length: v })}
                />
              }
            />
            <Row
              title="Показувати фертильне вікно"
              subtitle="тінт у календарі, поза прогнозом менструації"
              last
              control={
                <Toggle
                  label="Показувати фертильне вікно"
                  checked={settings.show_fertile_window}
                  onChange={(v) => patch({ show_fertile_window: v })}
                />
              }
            />
          </Card>

          <Card className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[14.5px] font-extrabold">Фази на графіку ваги</div>
              <div className="mt-0.5 text-[12px] font-semibold text-muted">
                фонові смуги в «Аналітиці»
              </div>
            </div>
            <Toggle
              label="Фази на графіку ваги"
              checked={settings.phase_bands_in_charts}
              onChange={(v) => patch({ phase_bands_in_charts: v })}
            />
          </Card>

          <Card>
            <div className="text-[14.5px] font-extrabold">Дані циклу</div>
            <div className="mt-1 text-[12.5px] font-semibold leading-[1.5] text-muted [text-wrap:pretty]">
              Вимкнення ховає фічу, але записи лишаються. Видалення прибирає їх назавжди —
              без відновлення.
            </div>
            <div className="mt-3.5 flex gap-2.5">
              <Button
                type="button"
                variant="outline"
                loading={busy === "export"}
                onClick={exportCsv}
                className="!py-[13px] !text-[13.5px]"
              >
                Експорт CSV
              </Button>
              <Button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="!bg-neg/10 !py-[13px] !text-[13.5px] !text-neg !shadow-none"
              >
                Видалити все
              </Button>
            </div>
          </Card>

          <CycleDisclaimer />
        </>
      )}

      {confirmOpen && (
        <Sheet open onClose={() => setConfirmOpen(false)} title="Видалити дані циклу?">
          <p className="text-[13.5px] font-semibold leading-[1.55] text-muted [text-wrap:pretty]">
            Зникнуть усі денні записи циклу й налаштування фічі. Прогнози й фази в
            аналітиці рахувати буде нізвідки. Відновити це неможливо — якщо потрібна копія,
            спершу зроби експорт CSV.
          </p>
          <div className="mt-4 flex flex-col gap-2.5">
            <Button
              type="button"
              loading={busy === "delete"}
              onClick={deleteAll}
              className="!bg-neg !shadow-none"
            >
              Так, видалити назавжди
            </Button>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Скасувати
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
