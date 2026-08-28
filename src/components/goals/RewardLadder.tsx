"use client";

import { Icon } from "@/components/icons";
import type { Reward } from "@/lib/types";
import { cn, fmt } from "@/lib/utils";

/**
 * Драбинка винагород: вертикальна стрічка часу. Вгорі — найдальша ціль,
 * внизу — вже досягнуті; між «наступною» та досягнутими стоїть маркер «Ти тут».
 * Стани вузлів: done (акцентне коло з галочкою), next (кільце зі свіченням),
 * locked (тонке кільце кольору лінії, картка притлумлена).
 */
export function RewardLadder({
  steps,
  isAchieved,
  nextId,
  latestWeight,
  remaining,
  progress,
  onSelect,
}: {
  /** Сходинки за зростанням ваги (найдальша ціль першою). */
  steps: Reward[];
  isAchieved: (weight: number) => boolean;
  nextId: string | null;
  latestWeight: number | null;
  remaining: number | null;
  progress: number | null;
  onSelect: (reward: Reward) => void;
}) {
  const firstAchievedIdx = steps.findIndex((r) => isAchieved(r.weight));

  return (
    <div className="flex flex-col">
      {steps.map((r, idx) => {
        const achieved = isAchieved(r.weight);
        const isNext = nextId === r.id;
        const kind = achieved ? "done" : isNext ? "next" : "locked";
        const showYouAreHere =
          idx === firstAchievedIdx && firstAchievedIdx > 0 && latestWeight != null;
        const hasLine = idx < steps.length - 1;
        return (
          <div key={r.id}>
            {showYouAreHere && <YouAreHere weight={latestWeight} />}
            <div className="flex items-stretch gap-[14px]">
              {/* Ліва вісь із вузлом і сполучною лінією */}
              <div className="flex flex-col items-center">
                <LadderNode kind={kind} />
                {hasLine && (
                  <div
                    aria-hidden
                    className={cn("w-[1.6px] flex-1", achieved ? "bg-accent" : "bg-line")}
                  />
                )}
              </div>

              {/* Картка сходинки */}
              <button
                type="button"
                onClick={() => onSelect(r)}
                aria-label={`${fmt(r.weight, 1)} кг — ${r.gift}${
                  achieved ? ", отримано" : isNext ? ", наступна" : ""
                }`}
                className={cn(
                  "mb-2 flex-1 rounded-[16px] bg-surface p-[15px] text-left transition active:scale-[.99]",
                  isNext &&
                    "shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--accent)_55%,transparent)]",
                  kind === "locked" && "opacity-60",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[14.5px] font-semibold text-ink">
                      {fmt(r.weight, 1)} кг
                      {isNext && (
                        <span className="ml-[7px] text-[10.5px] font-semibold uppercase tracking-[.06em] text-accent">
                          наступна
                        </span>
                      )}
                    </div>
                    <div className="mt-[2px] truncate text-[12px] font-normal text-muted">
                      {r.gift}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1 text-[11px] font-semibold",
                      achieved ? "text-pos" : "text-muted",
                    )}
                  >
                    {achieved ? (
                      <>
                        <Icon name="check" size={13} strokeWidth={2} />
                        отримано
                      </>
                    ) : (
                      <Icon name="lock" size={13} />
                    )}
                  </span>
                </div>

                {isNext && remaining != null && progress != null && (
                  <div className="mt-3">
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(progress * 100)}
                      className="h-[6px] overflow-hidden rounded-full bg-field"
                    >
                      <div
                        className="h-full rounded-full bg-accent transition-[width]"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                    <div className="mt-[7px] text-[11px] font-medium text-muted">
                      {remaining > 0
                        ? `ще ${fmt(remaining, 1)} кг · ${Math.round(progress * 100)}%`
                        : "майже досягнуто!"}
                    </div>
                  </div>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LadderNode({ kind }: { kind: "done" | "next" | "locked" }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full",
        kind === "done" && "bg-accent text-on-accent",
        kind === "next" &&
          "border-2 border-accent bg-surface shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_22%,transparent)]",
        kind === "locked" && "border-[1.6px] border-line bg-surface",
      )}
    >
      {kind === "done" && <Icon name="check" size={13} strokeWidth={2} />}
    </div>
  );
}

/** Маркер поточної ваги між «наступною» сходинкою та досягнутими. */
function YouAreHere({ weight }: { weight: number }) {
  return (
    <div className="flex items-center gap-[14px] pb-[6px]">
      <div className="flex w-[28px] justify-center">
        <div
          aria-hidden
          className="h-3 w-3 rounded-full bg-accent shadow-[0_0_0_3px_var(--bg),0_0_0_4.5px_var(--accent)]"
        />
      </div>
      <div className="py-1 text-[12px] font-semibold text-accent">
        Ти тут — {fmt(weight, 1)} кг
      </div>
    </div>
  );
}
