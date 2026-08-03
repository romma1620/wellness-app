import { describe, expect, it } from "vitest";
import { keyboardInset } from "./viewport";

describe("keyboardInset", () => {
  it("нуль, коли visual viewport збігається з layout", () => {
    expect(keyboardInset(844, 844, 0)).toBe(0);
  });
  it("перекриття = різниця висот", () => {
    expect(keyboardInset(844, 508, 0)).toBe(336);
  });
  it("враховує підкручений layout усередині visual viewport", () => {
    // iOS зсуває layout, щоб показати сфокусоване поле: цей зсув уже
    // компенсує частину перекриття, тож віднімати треба обидва доданки
    expect(keyboardInset(844, 508, 60)).toBe(276);
  });
  it("округлює дробові висоти", () => {
    expect(keyboardInset(844, 507.6, 0)).toBe(336);
  });
  it("нуль при відʼємній різниці (rubber-band на iOS)", () => {
    expect(keyboardInset(844, 900, 0)).toBe(0);
  });
  it("ігнорує дрібні розбіжності, щоб панель не сіпалась", () => {
    expect(keyboardInset(844, 836, 0)).toBe(0);
  });
});
