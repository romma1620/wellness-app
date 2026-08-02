import { Skeleton } from "@/components/ui";

/**
 * Плейсхолдер екрана тренувань: картка прогресу + один місячний блок.
 *
 * Висоти повторюють реальні елементи (`WorkoutProgress`, `WorkoutList`):
 * якщо вони розійдуться, поява даних смикне лейаут — саме те, що скелетон
 * має прибрати. Хедер із заголовком і кнопка «Нове тренування» тут не
 * дублюються: вони лишаються живими.
 */
export function WorkoutsSkeleton() {
  return (
    <div className="flex flex-col gap-[15px]" aria-busy="true">
      <span className="sr-only">Завантаження тренувань</span>

      {/* Прогрес: підпис 18.75 + 12 + тригер 51.5 + 12 + segmented 53 + 12 + графік 150 */}
      <div className="rounded-xl2 bg-surface p-4 shadow-card">
        <Skeleton className="mb-3 h-[18.75px] w-[128px]" />
        <Skeleton className="h-[51.5px] w-full rounded-[15px]" />
        <Skeleton className="mt-3 h-[53px] w-full rounded-[14px]" />
        <Skeleton className="mt-3 h-[150px] w-full rounded-[14px]" />
      </div>

      {/* Заголовок «Історія»: 17px × 1.2 = 20.4 */}
      <Skeleton className="ml-1 h-[20.4px] w-[84px]" />

      {/* Місячний блок: хедер (20.4 + 2 + 18) + три рядки по 56.5 */}
      <div className="overflow-hidden rounded-xl2 bg-surface shadow-card">
        <div className="px-4 pb-2 pt-4">
          <Skeleton className="h-[20.4px] w-[124px]" />
          <Skeleton className="mt-0.5 h-[18px] w-[104px]" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-t border-primary-light px-4 py-[11px]"
          >
            <Skeleton className="h-[34px] w-[34px]" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-[19.7px] w-[96px]" />
              <Skeleton className="mt-0.5 h-[18px] w-[62px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
