"use client";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 pt-20 text-center">
      <div className="flex h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-[color:color-mix(in_oklab,var(--neg)_13%,transparent)] text-neg">
        <Icon name="info" size={20} />
      </div>
      <div className="text-[17px] font-bold">Щось пішло не так</div>
      <p className="max-w-[260px] text-[12.5px] font-normal leading-[1.55] text-muted">
        Сталася помилка під час завантаження сторінки. Спробуй ще раз.
      </p>
      <div className="mt-2 w-full max-w-[220px]">
        <Button onClick={reset} className="text-[14px]">
          Спробувати знову
        </Button>
      </div>
    </div>
  );
}
