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
    <div className="flex flex-col gap-[14px]" aria-busy="true">
      <span className="sr-only">Завантаження тренувань</span>

      {/* Прогрес: підпис 16.5 + 12 + тригер 47 + 10 + segmented 44.75 + 14 + графік 150 +
          12 + картка порівняння 83.5 + 10 + рядок дат 16.5. Картка порівняння й рядок дат
          зʼявляються для будь-якої вправи з хоча б одним сетом — це типовий стан,
          а не рідкісний край, тож висота під них зарезервована тут теж. */}
      <div className="rounded-xl2 bg-surface p-[18px]">
        <Skeleton className="mb-3 h-[16.5px] w-[128px]" />
        <Skeleton className="h-[47px] w-full rounded-[13px]" />
        <Skeleton className="mt-[10px] h-[44.75px] w-full rounded-[13px]" />
        <Skeleton className="mt-[14px] h-[150px] w-full rounded-[13px]" />
        <Skeleton className="mt-3 h-[83.5px] w-full rounded-[13px]" />
        <Skeleton className="mx-auto mt-[10px] h-[16.5px] w-[150px]" />
      </div>

      {/* Підпис «Історія»: pt-1 (4) + text-[11px] × 1.5 = 16.5 → 20.5 */}
      <Skeleton className="ml-[2px] mt-1 h-[16.5px] w-[60px]" />

      {/* Місячний блок: хедер (16 + 21.75 + 10) + три рядки по 69 (24 + плитка 44 + 1) */}
      <div className="overflow-hidden rounded-xl2 bg-surface">
        <div className="flex items-baseline justify-between px-[18px] pb-[10px] pt-4">
          <Skeleton className="h-[21.75px] w-[124px]" />
          <Skeleton className="h-[17px] w-[104px]" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-t border-line px-[18px] py-3">
            <Skeleton className="h-[44px] w-[40px] rounded-[11px]" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-[20px] w-[96px]" />
              <Skeleton className="mt-[2px] h-[17px] w-[62px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
