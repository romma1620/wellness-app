"use client";

import { MetricLine, Sparkline } from "@/components/charts";
import { Icon } from "@/components/icons";
import { NumberField } from "@/components/inputs";
import { Button, Card, Chip, ErrorBanner, FullLoader, SectionLabel } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useUid } from "@/components/UserProvider";
import { MEASUREMENT_META, type Measurement, type MeasurementKey } from "@/lib/types";
import { cn, daysBetween, fmt, shortDate, todayISO } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

type Form = Record<MeasurementKey, number | null>;
const EMPTY: Form = { waist: null, hips: null, chest: null, leg: null, arm: null };

export function MeasurementsSection() {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [selected, setSelected] = useState<MeasurementKey>("waist");

  const rowsQ = useQuery({
    queryKey: ["measurements", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurements")
        .select("*")
        .eq("user_id", uid)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Measurement[];
    },
  });
  const rows = useMemo(() => rowsQ.data ?? [], [rowsQ.data]);
  const loading = rowsQ.isPending;
  const error = actionError ?? (rowsQ.isError ? "Не вдалося завантажити заміри." : null);

  // Форма засівається останнім заміром один раз: ревалідація кешу
  // не має переписувати цифри, які юзер уже правит.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !rowsQ.data) return;
    seeded.current = true;
    const latest = rowsQ.data[rowsQ.data.length - 1];
    if (latest) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- разовий seed форми зі знімка кешу
      setForm({
        waist: latest.waist,
        hips: latest.hips,
        chest: latest.chest,
        leg: latest.leg,
        arm: latest.arm,
      });
    }
  }, [rowsQ.data]);

  const latest = rows[rows.length - 1] ?? null;
  const prev = rows[rows.length - 2] ?? null;
  const daysSince = latest ? daysBetween(latest.date, todayISO()) : Infinity;
  const needReminder = !latest || daysSince > 14;

  async function save() {
    setSaving(true);
    setActionError(null);
    setSaved(false);
    try {
      const today = todayISO();
      const existing = rows.find((r) => r.date === today);
      const payload = { user_id: uid, date: today, ...form };
      if (existing) {
        const { error } = await supabase.from("measurements").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("measurements").insert(payload);
        if (error) throw error;
      }
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["measurements", uid] });
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setActionError("Не вдалося зберегти заміри. Спробуй ще раз.");
    } finally {
      setSaving(false);
    }
  }

  const seriesFor = (key: MeasurementKey) =>
    rows
      .filter((r) => r[key] != null)
      .map((r) => ({ label: shortDate(r.date), value: r[key] as number }));

  if (loading) return <FullLoader />;

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="-mt-[6px] px-[2px] text-[12px] font-medium text-muted">
        {latest ? `оновлено ${shortDate(latest.date)}` : "ще не заповнено"}
      </div>
      {needReminder && (
        <div className="flex items-center gap-3 rounded-xl2 bg-surface px-4 py-[15px]">
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px] bg-primary-light text-accent">
            <Icon name="clock" size={17} strokeWidth={1.8} />
          </div>
          <div className="text-[12.5px] font-medium leading-[1.5] text-ink">
            {latest
              ? "Час робити заміри — минуло понад 14 днів. Роби їх раз на 2 тижні зранку."
              : "Зроби перші заміри зранку — і зможеш стежити за динамікою."}
          </div>
        </div>
      )}

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Card as="form">
        <SectionLabel icon="ruler">Нові заміри · {shortDate(todayISO())}</SectionLabel>
        <div className="grid grid-cols-2 gap-[10px]">
          {MEASUREMENT_META.map((m) => (
            <NumberField
              key={m.key}
              label={m.label}
              suffix="см"
              min={0}
              max={300}
              value={form[m.key]}
              onChange={(v) => setForm((f) => ({ ...f, [m.key]: v }))}
            />
          ))}
        </div>
        <div className="mt-4">
          <Button type="button" onClick={save} loading={saving} className="text-[14.5px]">
            {saved ? (
              <>
                <Icon name="check" size={15} strokeWidth={2.2} />
                Збережено
              </>
            ) : (
              "Зберегти заміри"
            )}
          </Button>
        </div>
      </Card>

      {latest && (
        <div className="grid grid-cols-2 gap-[10px]">
          {MEASUREMENT_META.map((m, idx) => {
            const cur = latest[m.key];
            const before = prev?.[m.key] ?? null;
            const diff = cur != null && before != null ? cur - before : null;
            return (
              <Card key={m.key} className={cn("!p-[14px]", idx === MEASUREMENT_META.length - 1 && "col-span-2")}>
                <div className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted">
                  {m.label}
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-[22px] font-normal leading-[1.1] tracking-[-.01em]">
                    {fmt(cur, 1)}
                  </span>
                  <span className="text-[11.5px] font-medium text-muted">см</span>
                  {diff != null && Math.abs(diff) >= 0.05 && (
                    <span
                      className={cn(
                        "ml-auto flex items-center gap-[2px] text-[11px] font-semibold",
                        diff < 0 ? "text-pos" : "text-neg",
                      )}
                    >
                      <Icon name={diff < 0 ? "arrowDown" : "arrowUp"} size={10} strokeWidth={2.2} />
                      {fmt(Math.abs(diff), 1)}
                    </span>
                  )}
                  {diff != null && Math.abs(diff) < 0.05 && (
                    <span className="ml-auto text-[11px] font-semibold text-muted">—</span>
                  )}
                </div>
                <Sparkline values={seriesFor(m.key).map((s) => s.value)} />
              </Card>
            );
          })}
        </div>
      )}

      {rows.length >= 1 && (
        <Card>
          <SectionLabel icon="activity">Динаміка</SectionLabel>
          <div className="mb-3 flex flex-wrap gap-2">
            {MEASUREMENT_META.map((m) => (
              <Chip key={m.key} active={selected === m.key} onClick={() => setSelected(m.key)}>
                {m.label}
              </Chip>
            ))}
          </div>
          <MetricLine data={seriesFor(selected)} />
        </Card>
      )}
    </div>
  );
}
