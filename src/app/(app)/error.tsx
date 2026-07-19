"use client";

import { Button } from "@/components/ui";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 pt-24 text-center">
      <div className="text-[40px]">🌧️</div>
      <div className="text-[16px] font-extrabold">Щось пішло не так</div>
      <p className="max-w-[260px] text-[13px] font-medium text-muted">
        Сталася помилка під час завантаження сторінки. Спробуй ще раз.
      </p>
      <div className="w-full max-w-[220px]">
        <Button onClick={reset}>Спробувати знову</Button>
      </div>
    </div>
  );
}
