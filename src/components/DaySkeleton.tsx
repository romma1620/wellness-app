import { Card, Skeleton } from "@/components/ui";

/** Ширини чипів догляду — фіксовані рядки, щоб Tailwind знайшов класи при скануванні. */
const CHIP_WIDTHS = ["w-[62px]", "w-[58px]", "w-[66px]", "w-[62px]"];

/**
 * Плейсхолдер карток головної на час завантаження дня.
 *
 * Висоти повторюють реальні картки (`src/app/(app)/page.tsx`): якщо вони
 * розійдуться, поява даних смикне лейаут — саме те, що скелетон має прибрати.
 * Хедер із датою тут не дублюється: він лишається живим і клікабельним.
 *
 * Обмеження: скелетон моделює ПОРОЖНІЙ стан карток. `TagInput` малює рядок
 * чипів лише коли теги вже є, а `PresetChips` може мати більше чипів, ніж
 * чотири пресети — тож день зі спортивними тегами чи великою кількістю
 * тегів догляду все одно трохи зсуне лейаут при появі даних.
 */
export function DaySkeleton() {
  return (
    <div className="flex flex-col gap-[15px]" aria-busy="true">
      <span className="sr-only">Завантаження дня</span>

      {/* Вага: підпис 18.75 + 4 + число 40 + 4 + примітка 18 = 84.75 */}
      <Card>
        <Skeleton className="h-[18.75px] w-[52px]" />
        <Skeleton className="mt-1 h-[40px] w-[132px]" />
        <Skeleton className="mt-1 h-[18px] w-[148px]" />
      </Card>

      {/* Харчування: заголовок 18.75 + 12, далі сітка 2×2 полів по 77.25
          (підпис 18.75 + 7 + Input 51.5) з gap 12 = 197.25 */}
      <Card>
        <Skeleton className="mb-3 h-[18.75px] w-[86px]" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="mb-[7px] h-[18.75px] w-[54px]" />
              <Skeleton className="h-[51.5px] w-full rounded-[15px]" />
            </div>
          ))}
        </div>
      </Card>

      {/* Вода: рядок заголовка 19.5 + 12, далі 8 крапель по 26 = 57.5 */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-[18.75px] w-[48px]" />
          <Skeleton className="h-[19.5px] w-[96px]" />
        </div>
        <div className="flex justify-between">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[26px] w-[26px] rounded-full" />
          ))}
        </div>
      </Card>

      {/* Кроки + спорт */}
      <div className="flex flex-col gap-3">
        {/* Кроки: підпис 18.75 + 7 + Input 51.5 = 77.25 */}
        <Card>
          <Skeleton className="mb-[7px] h-[18.75px] w-[54px]" />
          <Skeleton className="h-[51.5px] w-full rounded-[15px]" />
        </Card>

        {/* Спорт: заголовок 18.75 + 12, далі порожній рядок вводу тегів 38.5 = 69.25 */}
        <Card>
          <Skeleton className="mb-3 h-[18.75px] w-[46px]" />
          <Skeleton className="h-[38.5px] w-full rounded-full" />
        </Card>
      </div>

      {/* Догляд: заголовок 18.75 + 12, далі чипи 38.5 + gap 12 + рядок вводу 38.5 = 119.75 */}
      <Card>
        <Skeleton className="mb-3 h-[18.75px] w-[118px]" />
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {CHIP_WIDTHS.map((w, i) => (
              <Skeleton key={i} className={`h-[38.5px] rounded-full ${w}`} />
            ))}
          </div>
          <Skeleton className="h-[38.5px] w-full rounded-full" />
        </div>
      </Card>

      {/* Коментар: заголовок 18.75 + 12, далі textarea на 3 рядки 95.25 = 126 */}
      <Card>
        <Skeleton className="mb-3 h-[18.75px] w-[110px]" />
        <Skeleton className="h-[95.25px] w-full rounded-[15px]" />
      </Card>
    </div>
  );
}
