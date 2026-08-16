"use client";

import { useState, type ReactNode } from "react";
import { ScatterChart } from "@/components/insights/ScatterChart";
import { Card } from "@/components/ui";
import { strengthOf, type PairAnalysis } from "@/lib/correlations";
import { cn, fmt, plural } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export interface PairCopy {
  icon: ReactNode;
  /** Фон квадрата іконки. */
  tint: string;
  xAxisLabel: string;
  xTickFormat?: (v: number) => string;
  zeroLine: boolean;
  /** Заголовок і речення для стану link — текст залежить від напряму diff. */
  link: (a: Extract<PairAnalysis, { state: "link" }>) => { title: string; text: string };
  noLinkText: string;
  noContrastText: string;
}

const STRENGTH_LABELS = {
  weak: "слабкий",
  notable: "помітний",
  strong: "сильний",
} as const;

/**
 * Гібридна картка інсайту: людський висновок завжди видно, scatter —
 * під «Деталями». Всі чотири стани — повноцінні відповіді, зокрема
 * «звʼязку не видно».
 */
export function PairInsightCard({
  analysis,
  copy,
}: {
  analysis: PairAnalysis;
  copy: PairCopy;
}) {
  const [open, setOpen] = useState(false);

  const { title, text } =
    analysis.state === "link"
      ? copy.link(analysis)
      : analysis.state === "no-link"
        ? { title: "Звʼязку не видно", text: copy.noLinkText }
        : analysis.state === "no-contrast"
          ? { title: "Тижні надто схожі", text: copy.noContrastText }
          : {
              title: "Ще збираємо дані",
              text: "Висновок зʼявиться, коли назбирається достатньо тижнів із заповненими даними.",
            };

  const expandable = analysis.state === "link" || analysis.state === "no-link";
  const weeksLabel = `${analysis.n} ${plural(analysis.n, "тиждень", "тижні", "тижнів")}`;

  return (
    <Card className="!p-4">
      <div className="flex items-start gap-[13px]">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: copy.tint }}
        >
          {copy.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-extrabold [text-wrap:pretty]">{title}</div>
          <div className="mt-0.5 text-[12.5px] font-semibold leading-[1.5] text-muted [text-wrap:pretty]">
            {text}
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted">
              {analysis.state === "collecting"
                ? `${weeksLabel} з ${analysis.needed}`
                : `${weeksLabel} · останні 6 міс`}
            </span>
            {expandable && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-0.5 text-[12px] font-extrabold text-primary"
              >
                Деталі
                <ChevronDown
                  size={14}
                  className={cn("transition-transform", open && "rotate-180")}
                />
              </button>
            )}
          </div>
        </div>
      </div>
      {expandable && open && (
        <div className="mt-3 border-t border-bg pt-3">
          <ScatterChart
            points={analysis.points}
            xLabel={copy.xAxisLabel}
            xTickFormat={copy.xTickFormat}
            zeroLine={copy.zeroLine}
            medianX={analysis.state === "link" ? analysis.medianX : undefined}
          />
          {analysis.r != null && (
            <div className="mt-1.5 text-center text-[11px] font-bold text-muted">
              Звʼязок {STRENGTH_LABELS[strengthOf(analysis.r)]} (r {fmt(analysis.r, 2)})
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
