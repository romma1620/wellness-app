import { describe, expect, it } from "vitest";
import { niceAxis, sparklinePoints } from "./chart-scale";
import { fmtFixed } from "./utils";

function labels(min: number, max: number): string[] {
  const axis = niceAxis(min, max);
  return axis.ticks.map((t) => fmtFixed(t, axis.decimals));
}

describe("niceAxis", () => {
  it("не дає однакових підписів на вузькому діапазоні ваги", () => {
    // Баг: домен [66.3, 68.65] + округлення до цілих давало 66, 67, 67, 68, 69.
    const ls = labels(66.8, 68.15);
    expect(new Set(ls).size).toBe(ls.length);
  });

  it("тримає домен рівним крайнім тікам і покриває дані", () => {
    const axis = niceAxis(66.8, 68.15);
    expect(axis.domain[0]).toBe(axis.ticks[0]);
    expect(axis.domain[1]).toBe(axis.ticks[axis.ticks.length - 1]);
    expect(axis.domain[0]).toBeLessThan(66.8);
    expect(axis.domain[1]).toBeGreaterThan(68.15);
  });

  it("робить крок рівномірним і 'круглим'", () => {
    const { ticks } = niceAxis(66.8, 68.15);
    const step = ticks[1] - ticks[0];
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i] - ticks[i - 1]).toBeCloseTo(step, 9);
      expect(ticks[i] / step).toBeCloseTo(Math.round(ticks[i] / step), 9);
    }
  });

  it("дає 3–7 тіків для типових діапазонів", () => {
    for (const [min, max] of [
      [66.8, 68.15],
      [0, 12000],
      [59.4, 59.9],
      [88, 104],
      [0.2, 0.35],
    ] as const) {
      const { ticks } = niceAxis(min, max);
      expect(ticks.length, `[${min}, ${max}]`).toBeGreaterThanOrEqual(3);
      expect(ticks.length, `[${min}, ${max}]`).toBeLessThanOrEqual(8);
    }
  });

  it("ніколи не повторює підписи на випадкових діапазонах", () => {
    let seed = 42;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 500; i++) {
      const min = rnd() * 200;
      const max = min + rnd() * 40;
      const ls = labels(min, max);
      expect(new Set(ls).size, `дублікати для [${min}, ${max}]: ${ls.join(", ")}`).toBe(ls.length);
      expect(ls.length, `замало тіків для [${min}, ${max}]`).toBeGreaterThanOrEqual(3);
    }
  });

  it("обробляє плоский ряд (всі значення однакові)", () => {
    const axis = niceAxis(70, 70);
    expect(axis.ticks.length).toBeGreaterThanOrEqual(3);
    expect(new Set(axis.ticks).size).toBe(axis.ticks.length);
    expect(axis.domain[0]).toBeLessThan(70);
    expect(axis.domain[1]).toBeGreaterThan(70);
  });

  it("не роздуває домен більш ніж удвічі від діапазону даних", () => {
    for (const [min, max] of [
      [66.8, 68.15],
      [88, 104],
      [45.2, 52.8],
      [59.4, 59.9],
    ] as const) {
      const { domain } = niceAxis(min, max);
      const span = domain[1] - domain[0];
      expect(span, `надто широкий домен для [${min}, ${max}]: ${domain.join("..")}`).toBeLessThan(
        (max - min) * 2,
      );
    }
  });

  it("не тягне нуль у діапазон, коли дані далеко від нуля", () => {
    const axis = niceAxis(66.8, 68.15);
    expect(axis.domain[0]).toBeGreaterThan(60);
  });

  it("уникає похибок float у тіках", () => {
    const { ticks, decimals } = niceAxis(0.2, 0.35);
    for (const t of ticks) {
      expect(Number(t.toFixed(decimals))).toBe(t);
    }
  });

  it("повертає 0 знаків для великих кроків", () => {
    expect(niceAxis(0, 12000).decimals).toBe(0);
  });

  it("не дублює підписи кроків у тисячах", () => {
    // Баг: автотіки recharts 0,300,600,900,1200 після /1000 давали 0|0|1|1|1.
    for (const maxSteps of [900, 1200, 2400, 4500, 8000, 12000]) {
      const ls = labels(0, maxSteps / 1000);
      expect(new Set(ls).size, `дублікати для ${maxSteps} кроків: ${ls.join(" | ")}`).toBe(
        ls.length,
      );
    }
  });

  it("не йде в мінус на невід'ємних даних", () => {
    expect(niceAxis(0, 12000).domain[0]).toBe(0);
    expect(niceAxis(0.2, 0.35).domain[0]).toBeGreaterThanOrEqual(0);
  });
});

describe("sparklinePoints", () => {
  const W = 100;
  const H = 28;
  const PAD = 4;

  it("центрує плоский ряд, а не кладе його на нижній край", () => {
    // Баг: span = max - min || 1 давав нормалізацію 0 -> усі точки внизу.
    const pts = sparklinePoints([70, 70, 70, 70], W, H, PAD);
    for (const p of pts) expect(p.y).toBeCloseTo(H / 2, 9);
  });

  it("веде зростаючий ряд знизу вгору", () => {
    const pts = sparklinePoints([1, 2, 3], W, H, PAD);
    expect(pts[0].y).toBeCloseTo(H - PAD, 9);
    expect(pts[2].y).toBeCloseTo(PAD, 9);
    expect(pts[1].y).toBeLessThan(pts[0].y);
  });

  it("тримає точки в межах полотна", () => {
    for (const vals of [[1, 5, 3, 9], [70, 70], [-4, 0, 12], [0.001, 0.002]]) {
      for (const p of sparklinePoints(vals, W, H, PAD)) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(W);
        expect(p.y).toBeGreaterThanOrEqual(PAD);
        expect(p.y).toBeLessThanOrEqual(H - PAD);
      }
    }
  });

  it("розтягує ряд на всю ширину", () => {
    const pts = sparklinePoints([1, 2, 3, 4, 5], W, H, PAD);
    expect(pts[0].x).toBe(0);
    expect(pts[pts.length - 1].x).toBeCloseTo(W, 9);
  });

  it("ігнорує нечислові значення замість того, щоб зламати весь графік", () => {
    const pts = sparklinePoints([1, Number.NaN, 3], W, H, PAD);
    expect(pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });

  it("повертає порожньо, коли малювати нічого", () => {
    expect(sparklinePoints([], W, H, PAD)).toEqual([]);
    expect(sparklinePoints([5], W, H, PAD)).toEqual([]);
  });
});

describe("fmtFixed", () => {
  it("тримає фіксовану кількість знаків", () => {
    expect(fmtFixed(67, 1)).toBe("67,0");
    expect(fmtFixed(66.5, 1)).toBe("66,5");
    // uk-UA розділяє тисячі нерозривним пробілом.
    expect(fmtFixed(12000, 0).replace(/\s/g, " ")).toBe("12 000");
  });
});
