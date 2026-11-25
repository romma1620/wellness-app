import { Icon } from "@/components/icons";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-app flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-ink">
      <div className="flex h-[46px] w-[46px] items-center justify-center rounded-[12px] bg-primary-light text-accent">
        <Icon name="leaf" size={20} />
      </div>
      <div className="text-[17px] font-medium">Сторінку не знайдено</div>
      <p className="max-w-[260px] text-[13px] font-normal leading-[1.55] text-muted">
        Такої сторінки немає — можливо, посилання застаріло.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex items-center justify-center rounded-[12px] bg-accent px-6 py-[12px] text-[14px] font-medium text-on-accent active:scale-[.98]"
      >
        На головну
      </Link>
    </div>
  );
}
