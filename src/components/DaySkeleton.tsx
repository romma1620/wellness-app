import { Card, Skeleton } from "@/components/ui";

/** Ширини чипів догляду — фіксовані рядки, щоб Tailwind знайшов класи при скануванні. */
const CHIP_WIDTHS = ["w-[62px]", "w-[58px]", "w-[66px]", "w-[62px]"];

/**
 * Плейсхолдер карток головної на час завантаження дня.
 *
 * Висоти повторюють реальні картки (`src/app/(app)/page.tsx`): якщо вони
 * розійдуться, поява даних смикне лейаут — саме те, що скелетон має прибрати.
 * Заголовок і тижнева стрічка тут не дублюються: вони лишаються живими
 * й клікабельними.
 *
 * Обмеження: скелетон моделює ПОРОЖНІЙ стан карток. Рядок циклу під вагою,
 * смуга Б/Ж/В і ряд тегів спорту зʼявляються лише з даними, а чипів догляду
 * може бути більше за чотири пресети — такі дні трохи зсунуть лейаут.
 */
export function DaySkeleton() {
  return (
    <div className="flex flex-col gap-[14px]" aria-busy="true">
      <span className="sr-only">Завантаження дня</span>

      {/* Вага: рядок підпису 22 + 12 + число 44 + графік */}
      <Card>
        <div className="flex items-center justify-between">
          <Skeleton className="h-[15px] w-[60px]" />
          <Skeleton className="h-[22px] w-[124px] rounded-full" />
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <Skeleton className="h-[44px] w-[150px]" />
          <Skeleton className="h-[40px] w-[110px] rounded-[10px]" />
        </div>
      </Card>

      {/* Плитки: 14 + кільце 52 + 7 + значення 18 + 7 + підписи 26.5 + 12 = 136.5 */}
      <div className="grid grid-cols-3 gap-[10px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-[7px] rounded-[18px] bg-surface px-2 pb-3 pt-[14px]"
          >
            <Skeleton className="h-[52px] w-[52px] rounded-full" />
            <Skeleton className="h-[18px] w-[48px]" />
            <div className="flex flex-col items-center gap-[2px]">
              <Skeleton className="h-[12px] w-[40px]" />
              <Skeleton className="h-[12.5px] w-[52px]" />
            </div>
          </div>
        ))}
      </div>

      {/* Харчування: заголовок 15 + 12, далі сітка 2×2 полів по 66.5
          (підпис 14 + 6 + Input 46.5) з gap 10 = 143 */}
      <Card>
        <Skeleton className="mb-3 h-[15px] w-[96px]" />
        <div className="grid grid-cols-2 gap-[10px]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="mb-[6px] h-[14px] w-[54px]" />
              <Skeleton className="h-[46.5px] w-full rounded-[13px]" />
            </div>
          ))}
        </div>
      </Card>

      {/* Спорт (заголовок 15 + 10 + чип 34.5) + роздільник + догляд (15 + 10 + чипи 34.5) */}
      <Card className="flex flex-col gap-[14px]">
        <div>
          <Skeleton className="mb-[10px] h-[15px] w-[54px]" />
          <Skeleton className="h-[34.5px] w-[92px] rounded-full" />
        </div>
        <div className="border-t border-line pt-[14px]">
          <Skeleton className="mb-[10px] h-[15px] w-[128px]" />
          <div className="flex flex-wrap gap-2">
            {CHIP_WIDTHS.map((w, i) => (
              <Skeleton key={i} className={`h-[34.5px] rounded-full ${w}`} />
            ))}
            <Skeleton className="h-[34.5px] w-[70px] rounded-full" />
          </div>
        </div>
      </Card>

      {/* Нотатка: заголовок 15 + 12, далі textarea на 3 рядки ~91 */}
      <Card>
        <Skeleton className="mb-3 h-[15px] w-[104px]" />
        <Skeleton className="h-[91px] w-full rounded-[13px]" />
      </Card>
    </div>
  );
}
