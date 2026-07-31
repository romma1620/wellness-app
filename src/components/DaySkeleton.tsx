import { Card, Skeleton } from "@/components/ui";

/** Ширини чипів догляду — фіксовані рядки, щоб Tailwind знайшов класи при скануванні. */
const CHIP_WIDTHS = ["w-[62px]", "w-[58px]", "w-[66px]", "w-[62px]"];

/**
 * Плейсхолдер карток головної на час завантаження дня.
 *
 * Висоти повторюють реальні картки (`src/app/(app)/page.tsx`): якщо вони
 * розійдуться, поява даних смикне лейаут — саме те, що скелетон має прибрати.
 * Хедер із датою тут не дублюється: він лишається живим і клікабельним.
 */
export function DaySkeleton() {
  return (
    <div className="flex flex-col gap-[15px]" aria-busy="true">
      <span className="sr-only">Завантаження дня</span>

      {/* Вага: підпис 17 + 4 + число 40 + 4 + примітка 16 */}
      <Card>
        <Skeleton className="h-[17px] w-[52px]" />
        <Skeleton className="mt-1 h-[40px] w-[132px]" />
        <Skeleton className="mt-1 h-[16px] w-[148px]" />
      </Card>

      {/* Харчування: заголовок 17 + 12, далі сітка 2×2 полів по 73 з gap 12 */}
      <Card>
        <Skeleton className="mb-3 h-[17px] w-[86px]" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="mb-[7px] h-[17px] w-[54px]" />
              <Skeleton className="h-[49px] w-full rounded-[15px]" />
            </div>
          ))}
        </div>
      </Card>

      {/* Вода: рядок заголовка 18 + 12, далі 8 крапель по 26 */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-[18px] w-[48px]" />
          <Skeleton className="h-[18px] w-[96px]" />
        </div>
        <div className="flex justify-between">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[26px] w-[26px] rounded-full" />
          ))}
        </div>
      </Card>

      {/* Кроки: одне числове поле */}
      <Card>
        <Skeleton className="mb-[7px] h-[17px] w-[54px]" />
        <Skeleton className="h-[49px] w-full rounded-[15px]" />
      </Card>

      {/* Спорт: заголовок 17 + 12, далі рядок вводу тегів 37 */}
      <Card>
        <Skeleton className="mb-3 h-[17px] w-[46px]" />
        <Skeleton className="h-[37px] w-full rounded-full" />
      </Card>

      {/* Догляд: заголовок 17 + 12, далі чипи 37 + gap 12 + рядок вводу 37 */}
      <Card>
        <Skeleton className="mb-3 h-[17px] w-[118px]" />
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {CHIP_WIDTHS.map((w) => (
              <Skeleton key={w} className={`h-[37px] rounded-full ${w}`} />
            ))}
          </div>
          <Skeleton className="h-[37px] w-full rounded-full" />
        </div>
      </Card>

      {/* Коментар: заголовок 17 + 12, далі textarea на 3 рядки 95 */}
      <Card>
        <Skeleton className="mb-3 h-[17px] w-[110px]" />
        <Skeleton className="h-[95px] w-full rounded-[15px]" />
      </Card>
    </div>
  );
}
