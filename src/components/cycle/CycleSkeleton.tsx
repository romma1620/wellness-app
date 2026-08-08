import { Skeleton } from "@/components/ui";

/** Форма екрана «Цикл» до приходу даних: картка стану, календар, підказка. */
export function CycleSkeleton() {
  return (
    <div className="flex flex-col gap-[15px]" aria-busy>
      <div className="rounded-xl2 bg-surface p-[18px] shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <Skeleton className="h-3 w-[130px]" />
            <Skeleton className="mt-2.5 h-8 w-[110px]" />
            <Skeleton className="mt-2.5 h-3.5 w-full max-w-[190px]" />
          </div>
          <Skeleton className="h-[74px] w-[74px] !rounded-full" />
        </div>
        <div className="mt-[15px] flex gap-2">
          <Skeleton className="h-[46px] flex-1 !rounded-[13px]" />
          <Skeleton className="h-[46px] flex-1 !rounded-[13px]" />
          <Skeleton className="h-[46px] flex-1 !rounded-[13px]" />
        </div>
      </div>

      <div className="rounded-xl2 bg-surface px-[14px] pb-[14px] pt-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-[30px] w-[30px] !rounded-[11px]" />
          <Skeleton className="h-4 w-[110px]" />
          <Skeleton className="h-[30px] w-[30px] !rounded-[11px]" />
        </div>
        <div className="grid grid-cols-7 gap-y-[5px]">
          {Array.from({ length: 42 }).map((_, i) => (
            <div key={i} className="flex justify-center py-px">
              <Skeleton className="h-[34px] w-[34px] !rounded-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-[13px] rounded-xl2 bg-surface p-4 shadow-card">
        <Skeleton className="h-[38px] w-[38px] shrink-0 !rounded-[13px]" />
        <div className="flex-1">
          <Skeleton className="h-3.5 w-[150px]" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-1.5 h-3 w-4/5" />
        </div>
      </div>
    </div>
  );
}
