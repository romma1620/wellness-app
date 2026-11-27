"use client";

import { BackLink } from "@/components/BackLink";
import { DishCalculator } from "@/components/calculator/DishCalculator";
import { ProductCalculator } from "@/components/calculator/ProductCalculator";
import { PageTitle, Segmented } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useState } from "react";

type Mode = "product" | "dish";

const MODES: { value: Mode; label: string }[] = [
  { value: "product", label: "Один продукт" },
  { value: "dish", label: "Страва" },
];

const SUBTITLES: Record<Mode, string> = {
  product: "Скільки сирого продукту в кожній готовій порції",
  dish: "Скільки кожного інгредієнта в кожній готовій порції",
};

export default function FoodCalculatorPage() {
  const [mode, setMode] = useState<Mode>("product");

  return (
    <div className="flex flex-col gap-[14px]">
      <PageTitle subtitle={SUBTITLES[mode]} right={<BackLink href="/settings" />}>
        Калькулятор їжі
      </PageTitle>

      <Segmented<Mode> options={MODES} value={mode} onChange={setMode} />

      {/* Обидва режими лишаються змонтованими: перемикання не губить введене. */}
      <div className={cn("flex flex-col gap-[14px]", mode !== "product" && "hidden")}>
        <ProductCalculator />
      </div>
      <div className={cn("flex flex-col gap-[14px]", mode !== "dish" && "hidden")}>
        <DishCalculator />
      </div>
    </div>
  );
}
