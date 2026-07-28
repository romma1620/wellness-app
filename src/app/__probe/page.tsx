"use client";

import { StepsBars, WeightChart } from "@/components/charts";

const STEPS = [
  null, null, null, null, 7300, 6100, 8000, 11800, 2300, 8400,
  11400, 10600, 9200, 8800, 10100, 10700, 9900, 3600, 12600, 10600,
  10100, 9300, 6800, 6200, 9900, 22200, 11000, null, null, null, null,
].map((steps, i) => ({ label: String(i + 1), steps }));

const WEIGHTS = [
  67.6, 67.2, 67.1, 67.2, 67.35, 67.9, 67.15, 67.9, 67.6, 67.3,
  67.25, 67.75, 67.75, 67.1, 67.45, 67.0, 67.35, 67.4, 66.85, 67.5,
  67.55, 67.55, 67.6, 67.2, 67.85, 68.15, 67.35, null, null, null, null,
].map((weight, i) => ({ label: String(i + 1), weight, ma: weight }));

export default function Probe() {
  return (
    <div className="bg-app p-4" style={{ width: 390 }}>
      <div id="steps" className="mb-6 rounded-3xl bg-surface p-4">
        <StepsBars data={STEPS} />
      </div>
      <div id="weight" className="rounded-3xl bg-surface p-4">
        <WeightChart data={WEIGHTS} />
      </div>
    </div>
  );
}
