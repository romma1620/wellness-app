import { macroSplit } from "@/lib/nutrition";

/** Кольори сегментів — дані, не акцент інтерфейсу: білок акцентом, жири й вуглеводи як у дизайні. */
const FAT_COLOR = "#B98A93";
const CARBS_COLOR = "#7FAE95";

/** Смуга розподілу калорій Б/Ж/В за введеними грамами дня. Порожня, коли нема що ділити. */
export function MacroBar({
  protein,
  fat,
  carbs,
}: {
  protein: number | null;
  fat: number | null;
  carbs: number | null;
}) {
  const split = macroSplit([{ protein, fat, carbs }]);
  if (!split) return null;
  const p = Math.round(split.proteinPct);
  const f = Math.round(split.fatPct);
  const c = Math.max(0, 100 - p - f); // сума завжди 100, без похибки округлення
  const segs = [
    { pct: p, color: "var(--accent)" },
    { pct: f, color: FAT_COLOR },
    { pct: c, color: CARBS_COLOR },
  ];
  return (
    <div className="mt-[14px] border-t border-line pt-3">
      <div className="flex h-2 gap-[2px] overflow-hidden rounded-full" aria-hidden>
        {segs
          .filter((s) => s.pct > 0)
          .map((s) => (
            <div
              key={s.color}
              className="rounded-full"
              style={{ width: `${s.pct}%`, background: s.color }}
            />
          ))}
      </div>
      <div className="mt-[9px] flex justify-between text-[10.5px] font-medium text-muted">
        <span>Білок {p}%</span>
        <span>Жири {f}%</span>
        <span>Вуглеводи {c}%</span>
      </div>
    </div>
  );
}
