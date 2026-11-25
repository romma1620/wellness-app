import { Skeleton } from "@/components/ui";

/** Форма екрана «Цикл» до приходу даних: картка стану, календар, підказка. */
export function CycleSkeleton() {
  return (
    <div className="flex flex-col gap-[16px]" aria-busy>
      <div className="rounded-xl2 bg-surface px-[20px] py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <Skeleton className="h-3 w-[130px]" />
            <Skeleton className="mt-3 h-8 w-[110px]" />
            <Skeleton className="mt-3 h-3.5 w-full max-w-[190px]" />
          </div>
          <Skeleton className="h-[78px] w-[78px] !rounded-full" />
        </div>
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-[50px] flex-1 !rounded-[12px]" />
          <Skeleton className="h-[50px] flex-1 !rounded-[12px]" />
          <Skeleton className="h-[50px] flex-1 !rounded-[12px]" />
        </div>
      </div>

      <div className="rounded-xl2 bg-surface px-[16px] pb-[16px] pt-4">
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-[30px] w-[30px] !rounded-[10px]" />
          <Skeleton className="h-4 w-[110px]" />
          <Skeleton className="h-[30px] w-[30px] !rounded-[10px]" />
        </div>
        <div className="grid grid-cols-7 gap-y-[4px]">
          {Array.from({ length: 42 }).map((_, i) => (
            <div key={i} className="flex justify-center py-px">
              <Skeleton className="h-[34px] w-[34px] !rounded-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-[12px] rounded-xl2 bg-surface p-[20px]">
        <Skeleton className="h-[38px] w-[38px] shrink-0 !rounded-[12px]" />
        <div className="flex-1">
          <Skeleton className="h-3.5 w-[150px]" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-4/5" />
        </div>
      </div>
    </div>
  );
}
