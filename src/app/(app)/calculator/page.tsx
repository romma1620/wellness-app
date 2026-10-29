"use client";

import { BackLink } from "@/components/BackLink";
import { Icon } from "@/components/icons";
import {
  Button,
  Card,
  Chip,
  FieldLabel,
  IconButton,
  Input,
  PageTitle,
  SectionLabel,
} from "@/components/ui";
import { calcFood, FOOD_PRESETS, type FoodGroup } from "@/lib/food-calc";
import { cn, fmt, fmtInt, parseNum } from "@/lib/utils";
import { useRef, useState, type ChangeEvent } from "react";

const GROUPS: { group: FoodGroup; label: string }[] = [
  { group: "meat", label: "Мʼясо і риба" },
  { group: "grain", label: "Крупи, макарони, бобові" },
  { group: "other", label: "Інше" },
];

const START_PORTIONS = 2;

/** Пропси для поля ваги: лише цифри, кома, крапка — як у `useDecimalBuffer`. */
function grams(value: string, set: (v: string) => void) {
  return {
    inputMode: "decimal" as const,
    value,
    suffix: "г",
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      if (/^[0-9.,\s]*$/.test(e.target.value)) set(e.target.value);
    },
  };
}

export default function FoodCalculatorPage() {
  const [presetId, setPresetId] = useState(FOOD_PRESETS[0].id);
  const [raw, setRaw] = useState("");
  const nextId = useRef(START_PORTIONS);
  const [portions, setPortions] = useState(() =>
    Array.from({ length: START_PORTIONS }, (_, id) => ({ id, value: "" })),
  );

  const preset = FOOD_PRESETS.find((p) => p.id === presetId) ?? FOOD_PRESETS[0];
  const grain = preset.group === "grain";

  const result = calcFood({
    raw: parseNum(raw),
    portions: portions.map((p) => parseNum(p.value)),
    presetRatio: preset.ratio,
  });
  const ok = result.status === "ok" ? result : null;
  const rawByIndex = new Map(ok?.portions.map((p) => [p.index, p.raw]));

  function setPortion(id: number, value: string) {
    setPortions((ps) => ps.map((p) => (p.id === id ? { ...p, value } : p)));
  }

  function addPortion() {
    setPortions((ps) => [...ps, { id: nextId.current++, value: "" }]);
  }

  function removePortion(id: number) {
    setPortions((ps) => ps.filter((p) => p.id !== id));
  }

  function reset() {
    setRaw("");
    setPortions(
      Array.from({ length: START_PORTIONS }, () => ({ id: nextId.current++, value: "" })),
    );
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <PageTitle
        subtitle="Скільки сирого продукту в кожній готовій порції"
        right={<BackLink href="/settings" />}
      >
        Калькулятор їжі
      </PageTitle>

      <Card>
        <SectionLabel icon="fork">Продукт</SectionLabel>
        <div className="flex flex-col gap-3">
          {GROUPS.map((g) => (
            <div key={g.group}>
              <FieldLabel>{g.label}</FieldLabel>
              <div className="flex flex-wrap gap-[6px]">
                {FOOD_PRESETS.filter((p) => p.group === g.group).map((p) => (
                  <Chip key={p.id} active={p.id === presetId} onClick={() => setPresetId(p.id)}>
                    {p.label}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionLabel icon="scale">Зважування</SectionLabel>
        <FieldLabel>{grain ? "Суха вага (до варіння)" : "Сира вага"}</FieldLabel>
        <Input placeholder={grain ? "300" : "800"} {...grams(raw, setRaw)} />
      </Card>

      <Card>
        <SectionLabel
          icon="grid"
          right={
            ok && (
              <span className="text-[11px] font-semibold text-muted">
                {grain ? "сухої" : "сирої"} на порцію
              </span>
            )
          }
        >
          Готові порції
        </SectionLabel>
        <div className="flex flex-col gap-[10px]">
          {portions.map((p, i) => {
            const r = rawByIndex.get(i);
            return (
              <div key={p.id} className="flex items-center gap-[10px]">
                <span className="w-[18px] shrink-0 text-center text-[12px] font-semibold text-muted">
                  {i + 1}
                </span>
                <Input
                  className="min-w-0 flex-1"
                  placeholder="Готова"
                  aria-label={`Порція ${i + 1}, готова вага`}
                  {...grams(p.value, (v) => setPortion(p.id, v))}
                />
                <span
                  className={cn(
                    "w-[72px] shrink-0 text-right text-[16px] font-bold tabular-nums",
                    r === undefined ? "text-muted" : "text-accent",
                  )}
                >
                  {r === undefined ? "—" : `${ok?.estimated ? "≈" : ""}${fmtInt(r)} г`}
                </span>
                <IconButton
                  icon="x"
                  label={`Прибрати порцію ${i + 1}`}
                  size={13}
                  onClick={() => removePortion(p.id)}
                  disabled={portions.length === 1}
                />
              </div>
            );
          })}
          <Chip dashed icon="plus" onClick={addPortion} className="self-start">
            Додати порцію
          </Chip>
        </div>
      </Card>

      {ok && (
        <Card>
          <SectionLabel icon="info">Підсумок</SectionLabel>
          {ok.estimated && (
            <p className="mb-3 rounded-[12px] bg-primary-light px-3 py-[10px] text-[12px] font-medium leading-[1.5] text-accent">
              {grain ? "Суху" : "Сиру"} вагу не вказано — рахую орієнтовно за типовим коефіцієнтом для «
              {preset.label.toLowerCase()}». Для точності зваж продукт до готування.
            </p>
          )}
          <dl className="flex flex-col gap-2 text-[13px]">
            <Row label="Коефіцієнт готове / сире" value={`×${fmt(ok.ratio, 2)}`} />
            {!ok.estimated && (
              <Row
                label={ok.ratio >= 1 ? "Набрало вагу" : "Втратило вагу"}
                value={`${ok.ratio >= 1 ? "+" : "−"}${fmtInt(Math.abs(ok.ratio - 1) * 100)}%`}
              />
            )}
            <Row
              label={`Разом у порціях (${ok.portions.length})`}
              value={`${fmtInt(ok.portionsCooked)} г → ${fmtInt(ok.portionsRaw)} г ${grain ? "сухої" : "сирої"}`}
            />
          </dl>
        </Card>
      )}

      {result.status === "empty" && (
        <p className="px-4 text-center text-[12px] font-normal leading-[1.55] text-muted">
          Введи сиру вагу і вагу готових порцій — калькулятор розкладе сирий продукт між
          ними пропорційно. Нічого не зберігається.
        </p>
      )}

      <Button type="button" variant="outline" onClick={reset}>
        <Icon name="trash" size={15} strokeWidth={1.8} />
        Очистити
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="font-medium text-muted">{label}</dt>
      <dd className="text-right font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
