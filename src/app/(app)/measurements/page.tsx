"use client";

import { BackLink } from "@/components/BackLink";
import { MeasurementsSection } from "@/components/MeasurementsSection";
import { PageTitle } from "@/components/ui";

export default function MeasurementsPage() {
  return (
    <div className="flex flex-col gap-[14px]">
      <PageTitle right={<BackLink href="/settings" />}>Заміри тіла</PageTitle>
      <MeasurementsSection />
    </div>
  );
}
