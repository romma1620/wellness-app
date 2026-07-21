"use client";

import { MeasurementsSection } from "@/components/MeasurementsSection";

export default function MeasurementsPage() {
  return (
    <div className="flex flex-col gap-[15px]">
      <h1 className="px-1 pt-1 text-[22px] font-extrabold">Заміри тіла</h1>
      <MeasurementsSection />
    </div>
  );
}
