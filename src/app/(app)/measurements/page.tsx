"use client";

import { MeasurementsSection } from "@/components/MeasurementsSection";
import Link from "next/link";

export default function MeasurementsPage() {
  return (
    <div className="flex flex-col gap-[15px]">
      <div className="flex items-center gap-2 px-1 pt-1">
        <Link href="/settings" aria-label="Назад" className="text-muted">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M13 5l-6 6 6 6" /></svg>
        </Link>
        <h1 className="text-[22px] font-extrabold">Заміри тіла</h1>
      </div>
      <MeasurementsSection />
    </div>
  );
}
