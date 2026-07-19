import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-app flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <div className="text-[44px]">🍃</div>
      <div className="text-[18px] font-extrabold">Сторінку не знайдено</div>
      <Link
        href="/"
        className="rounded-2xl bg-primary px-6 py-3 text-[15px] font-extrabold text-white shadow-cta"
      >
        На головну
      </Link>
    </div>
  );
}
