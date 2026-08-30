import { Icon } from "@/components/icons";
import { goalFraction, goalSub } from "@/lib/goals";

/**
 * Бейдж цілі в шапці картки показника — на тому ж місці, де у ваги стоїть
 * тижнева дельта, і в тій самій пілюлі.
 *
 * Три стани: цілі нема — сам підпис-запрошення; ціль не добрана — доріжка з
 * акцентною смужкою; ціль виконана — зелена пілюля з галочкою, як мінус ваги.
 * Кільце сюди не повернулось навмисно: у картці на всю ширину прогрес читаємо
 * смужкою, а велике число лишається головним.
 */
export function GoalBadge({ value, goal }: { value: number | null; goal: number | null }) {
  const label = goalSub(goal);
  const frac = goalFraction(value, goal);
  const done = goal !== null && frac >= 1;

  if (done) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-[color:color-mix(in_oklab,var(--pos)_14%,transparent)] px-[10px] py-1 text-[11.5px] font-semibold text-pos">
        <Icon name="check" size={11} strokeWidth={2.4} />
        {label}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-[6px] rounded-full bg-field px-[10px] py-1 text-[11.5px] font-semibold text-muted">
      {goal !== null && (
        <span aria-hidden className="relative flex h-1 w-[44px] shrink-0 items-center">
          <span className="absolute inset-x-0 h-1 rounded-full bg-line" />
          <span
            className="absolute left-0 h-1 rounded-full bg-accent"
            style={{ width: `${Math.round(frac * 100)}%` }}
          />
        </span>
      )}
      {label}
    </span>
  );
}
