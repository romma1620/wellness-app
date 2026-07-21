"use client";

import { MetricLine, Sparkline } from "@/components/charts";
import { NumberField } from "@/components/inputs";
import { Button, Card, ErrorBanner, FullLoader, SectionLabel } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { MEASUREMENT_META, type Measurement, type MeasurementKey } from "@/lib/types";
import { cn, daysBetween, fmt, shortDate, todayISO } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

type Form = Record<MeasurementKey, number | null>;
const EMPTY: Form = { waist: null, hips: null, chest: null, leg: null, arm: null };

export function MeasurementsSection() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Measurement[]>([]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [selected, setSelected] = useState<MeasurementKey>("waist");

  const load = useMemo(
    () => async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (!uid) throw new Error("no-user");
        const { data, error } = await supabase
          .from("measurements")
          .select("*")
          .eq("user_id", uid)
          .order("date", { ascending: true });
        if (error) throw error;
        const list = (data ?? []) as Measurement[];
        setRows(list);
        const latest = list[list.length - 1];
        if (latest) {
          setForm({
            waist: latest.waist,
            hips: latest.hips,
            chest: latest.chest,
            leg: latest.leg,
            arm: latest.arm,
          });
        }
      } catch {
        setError("Не вдалося завантажити заміри.");
      } finally {
        setLoading(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    load();
  }, [load]);

  const latest = rows[rows.length - 1] ?? null;
  const prev = rows[rows.length - 2] ?? null;
  const daysSince = latest ? daysBetween(latest.date, todayISO()) : Infinity;
  const needReminder = !latest || daysSince > 14;

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("no-user");
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
      await load();
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Не вдалося зберегти заміри. Спробуй ще раз.");
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
    <div className="flex flex-col gap-[15px]">
      <div className="px-1 text-[12.5px] font-semibold text-muted">
        {latest ? `оновлено ${shortDate(latest.date)}` : "ще не заповнено"}
      </div>
      {needReminder && (
        <div className="flex items-center gap-3 rounded-[18px] bg-primary-light px-4 py-[15px]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-primary">
            <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M11 7v4l3 2" />
            </svg>
          </div>
          <div className="text-[13px] font-bold leading-snug text-primary">
            {latest
              ? "Час робити заміри — минуло понад 14 днів. Роби їх раз на 2 тижні зранку."
              : "Зроби перші заміри зранку — і зможеш стежити за динамікою."}
          </div>
        </div>
      )}

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Card as="form">
        <SectionLabel>Нові заміри · {shortDate(todayISO())}</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
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
          <Button type="button" onClick={save} loading={saving}>
            {saved ? "✓ Збережено" : "Зберегти заміри"}
          </Button>
        </div>
      </Card>

      {latest && (
        <div className="grid grid-cols-2 gap-3">
          {MEASUREMENT_META.map((m, idx) => {
            const cur = latest[m.key];
            const before = prev?.[m.key] ?? null;
            const diff = cur != null && before != null ? cur - before : null;
            return (
              <Card key={m.key} className={cn("!p-[14px]", idx === MEASUREMENT_META.length - 1 && "col-span-2")}>
                <div className="text-[12px] font-bold text-muted">{m.label}</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-[22px] font-extrabold">{fmt(cur, 1)}</span>
                  <span className="text-[12px] font-bold text-muted">см</span>
                  {diff != null && Math.abs(diff) >= 0.05 && (
                    <span className={cn("ml-auto text-[11px] font-extrabold", diff < 0 ? "text-pos" : "text-neg")}>
                      {diff < 0 ? "↓" : "↑"}
                      {fmt(Math.abs(diff), 1)}
                    </span>
                  )}
                  {diff != null && Math.abs(diff) < 0.05 && (
                    <span className="ml-auto text-[11px] font-extrabold text-muted">—</span>
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
          <SectionLabel>Динаміка</SectionLabel>
          <div className="mb-3 flex flex-wrap gap-2">
            {MEASUREMENT_META.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setSelected(m.key)}
                className={cn(
                  "rounded-full px-[13px] py-[7px] text-[12.5px] transition",
                  selected === m.key
                    ? "bg-primary font-bold text-white"
                    : "border-[1.5px] border-primary-light bg-bg font-semibold text-muted",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <MetricLine data={seriesFor(selected)} />
        </Card>
      )}
    </div>
  );
}
