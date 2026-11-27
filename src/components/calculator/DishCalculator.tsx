"use client";

import { fmtGrams, grams, Row, RowNum, START_PORTIONS } from "@/components/calculator/fields";
import { Icon } from "@/components/icons";
import { Button, Card, Chip, IconButton, Input, SectionLabel } from "@/components/ui";
import { calcDish } from "@/lib/food-calc";
import { cn, fmt, fmtInt, parseNum } from "@/lib/utils";
import { useRef, useState } from "react";

/** Курка, овочі й соус — типовий мінімум для страви. */
const START_INGREDIENTS = 3;
const NAME_HINTS = ["Курка", "Перець", "Соус"];

interface IngredientRow {
  id: number;
  name: string;
  raw: string;
}

interface PortionRow {
  id: number;
  value: string;
}

/**
 * Складна страва з кількох інгредієнтів: вносиш сиру вагу кожного і вагу
 * готових порцій — отримуєш, скільки кожного інгредієнта в кожній порції.
 */
export function DishCalculator() {
  // id нумеруються наскрізно для обох списків: 0…2 інгредієнти, 3…4 порції.
  const nextId = useRef(START_INGREDIENTS + START_PORTIONS);
  const [ingredients, setIngredients] = useState(() =>
    Array.from({ length: START_INGREDIENTS }, (_, id): IngredientRow => ({ id, name: "", raw: "" })),
  );
  const [portions, setPortions] = useState(() =>
    Array.from(
      { length: START_PORTIONS },
      (_, i): PortionRow => ({ id: START_INGREDIENTS + i, value: "" }),
    ),
  );

  const result = calcDish({
    ingredients: ingredients.map((i) => ({ name: i.name, raw: parseNum(i.raw) })),
    portions: portions.map((p) => parseNum(p.value)),
  });
  const ok = result.status === "ok" ? result : null;
  const shareByIndex = new Map(ok?.portions.map((p) => [p.index, p.share]));
  const rawSum = ingredients.reduce((s, i) => s + Math.max(parseNum(i.raw) ?? 0, 0), 0);

  function patchIngredient(id: number, patch: Partial<IngredientRow>) {
    setIngredients((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function setPortion(id: number, value: string) {
    setPortions((ps) => ps.map((p) => (p.id === id ? { ...p, value } : p)));
  }

  function reset() {
    setIngredients(
      Array.from({ length: START_INGREDIENTS }, () => ({ id: nextId.current++, name: "", raw: "" })),
    );
    setPortions(Array.from({ length: START_PORTIONS }, () => ({ id: nextId.current++, value: "" })));
  }

  return (
    <>
      <Card>
        <SectionLabel
          icon="fork"
          right={
            rawSum > 0 && (
              <span className="text-[11px] font-semibold text-muted">разом {fmtGrams(rawSum)}</span>
            )
          }
        >
          Інгредієнти (сира вага)
        </SectionLabel>
        <div className="flex flex-col gap-[10px]">
          {ingredients.map((ing, i) => (
            <div key={ing.id} className="flex items-center gap-[10px]">
              <RowNum>{i + 1}</RowNum>
              <Input
                className="min-w-0 flex-1"
                placeholder={NAME_HINTS[i] ?? "Назва"}
                aria-label={`Інгредієнт ${i + 1}, назва`}
                value={ing.name}
                onChange={(e) => patchIngredient(ing.id, { name: e.target.value })}
              />
              <Input
                className="w-[104px] shrink-0"
                placeholder="Вага"
                aria-label={`Інгредієнт ${i + 1}, сира вага`}
                {...grams(ing.raw, (raw) => patchIngredient(ing.id, { raw }))}
              />
              <IconButton
                icon="x"
                label={`Прибрати інгредієнт ${i + 1}`}
                size={13}
                onClick={() => setIngredients((xs) => xs.filter((x) => x.id !== ing.id))}
                disabled={ingredients.length === 1}
              />
            </div>
          ))}
          <Chip
            dashed
            icon="plus"
            onClick={() =>
              setIngredients((xs) => [...xs, { id: nextId.current++, name: "", raw: "" }])
            }
            className="self-start"
          >
            Додати інгредієнт
          </Chip>
        </div>
      </Card>

      <Card>
        <SectionLabel
          icon="grid"
          right={
            ok && <span className="text-[11px] font-semibold text-muted">частка страви</span>
          }
        >
          Готові порції
        </SectionLabel>
        <div className="flex flex-col gap-[10px]">
          {portions.map((p, i) => {
            const share = shareByIndex.get(i);
            return (
              <div key={p.id} className="flex items-center gap-[10px]">
                <RowNum>{i + 1}</RowNum>
                <Input
                  className="min-w-0 flex-1"
                  placeholder="Готова"
                  aria-label={`Порція ${i + 1}, готова вага`}
                  {...grams(p.value, (v) => setPortion(p.id, v))}
                />
                <span
                  className={cn(
                    "w-[56px] shrink-0 text-right text-[16px] font-bold tabular-nums",
                    share === undefined ? "text-muted" : "text-accent",
                  )}
                >
                  {share === undefined ? "—" : `${fmtInt(share * 100)}%`}
                </span>
                <IconButton
                  icon="x"
                  label={`Прибрати порцію ${i + 1}`}
                  size={13}
                  onClick={() => setPortions((ps) => ps.filter((x) => x.id !== p.id))}
                  disabled={portions.length === 1}
                />
              </div>
            );
          })}
          <Chip
            dashed
            icon="plus"
            onClick={() => setPortions((ps) => [...ps, { id: nextId.current++, value: "" }])}
            className="self-start"
          >
            Додати порцію
          </Chip>
        </div>
      </Card>

      {ok &&
        ok.portions.map((p) => (
          <Card key={p.index}>
            <SectionLabel
              icon="scale"
              right={
                <span className="text-[11px] font-semibold text-muted">
                  {fmtInt(p.cooked)} г готової
                </span>
              }
            >
              Порція {p.index + 1}
            </SectionLabel>
            <dl className="flex flex-col gap-2 text-[13px]">
              {p.items.map((item) => (
                <Row key={item.index} label={item.name} value={fmtGrams(item.raw)} />
              ))}
              <div className="mt-1 border-t border-line pt-2">
                <Row label="Разом сирого" value={fmtGrams(p.raw)} />
              </div>
            </dl>
          </Card>
        ))}

      {ok && (
        <Card>
          <SectionLabel icon="info">Підсумок</SectionLabel>
          <dl className="flex flex-col gap-2 text-[13px]">
            <Row
              label={`Сирі інгредієнти (${ok.ingredients.length})`}
              value={fmtGrams(ok.totalRaw)}
            />
            <Row label={`Готова страва (${ok.portions.length} порц.)`} value={fmtGrams(ok.totalCooked)} />
            <Row label="Коефіцієнт готове / сире" value={`×${fmt(ok.ratio, 2)}`} />
          </dl>
        </Card>
      )}

      {result.status === "empty" && (
        <p className="px-4 text-center text-[12px] font-normal leading-[1.55] text-muted">
          Зваж кожен інгредієнт до готування, а потім готові порції — калькулятор покаже,
          скільки кожного інгредієнта потрапило в кожну порцію. Нічого не зберігається.
        </p>
      )}

      <Button type="button" variant="outline" onClick={reset}>
        <Icon name="trash" size={15} strokeWidth={1.8} />
        Очистити
      </Button>
    </>
  );
}
