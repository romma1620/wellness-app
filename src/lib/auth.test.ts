import { describe, expect, it } from "vitest";
import {
  RESEND_COOLDOWN_S,
  cooldownLeft,
  isSignupOfExistingEmail,
  isValidOtp,
  translateAuthError,
} from "./auth";

describe("translateAuthError", () => {
  it("перекладає типові помилки Supabase", () => {
    expect(translateAuthError(new Error("Invalid login credentials"))).toBe(
      "Невірний email або пароль",
    );
    expect(translateAuthError(new Error("User already registered"))).toBe(
      "Такий email уже зареєстровано",
    );
    expect(translateAuthError(new Error("Email not confirmed"))).toBe(
      "Спершу підтверди email — введи код із листа",
    );
  });

  it("перекладає помилки OTP-коду", () => {
    // Supabase повертає один текст і для невірного, і для протермінованого коду.
    expect(translateAuthError(new Error("Token has expired or is invalid"))).toBe(
      "Код невірний або застарів. Перевір його або надішли новий",
    );
    expect(translateAuthError(new Error("Otp has expired"))).toBe(
      "Код невірний або застарів. Перевір його або надішли новий",
    );
  });

  it("перекладає помилки паролів", () => {
    expect(translateAuthError(new Error("Password should be at least 6 characters."))).toBe(
      "Пароль має містити щонайменше 6 символів",
    );
    expect(
      translateAuthError(new Error("New password should be different from the old password.")),
    ).toBe("Новий пароль має відрізнятися від старого");
  });

  it("перекладає ліміти відправки листів", () => {
    expect(translateAuthError(new Error("Email rate limit exceeded"))).toBe(
      "Забагато листів за короткий час. Спробуй трохи пізніше",
    );
    expect(
      translateAuthError(
        new Error("For security purposes, you can only request this after 42 seconds."),
      ),
    ).toBe("Забагато спроб. Спробуй трохи пізніше");
    expect(translateAuthError(new Error("Request rate limit reached"))).toBe(
      "Забагато спроб. Спробуй трохи пізніше",
    );
  });

  it("невідома помилка → загальний текст, не-Error теж не ламає", () => {
    expect(translateAuthError(new Error(""))).toBe("Щось пішло не так. Спробуй ще раз");
    expect(translateAuthError("boom")).toBe("boom");
    expect(translateAuthError(undefined)).toBe("Щось пішло не так. Спробуй ще раз");
  });
});

describe("isValidOtp", () => {
  it("приймає рівно 6 цифр", () => {
    expect(isValidOtp("123456")).toBe(true);
    expect(isValidOtp("000000")).toBe(true);
  });

  it("відхиляє все інше", () => {
    expect(isValidOtp("12345")).toBe(false);
    expect(isValidOtp("1234567")).toBe(false);
    expect(isValidOtp("12a456")).toBe(false);
    expect(isValidOtp("")).toBe(false);
    expect(isValidOtp("12 456")).toBe(false);
  });
});

describe("cooldownLeft", () => {
  const t0 = 1_000_000;

  it("одразу після відправки — повний кулдаун", () => {
    expect(cooldownLeft(t0, t0)).toBe(RESEND_COOLDOWN_S);
  });

  it("рахує залишок з округленням угору", () => {
    expect(cooldownLeft(t0, t0 + 100)).toBe(RESEND_COOLDOWN_S); // 0.1с → усе ще 60
    expect(cooldownLeft(t0, t0 + 59_500)).toBe(1);
  });

  it("після завершення — нуль, не відʼємне", () => {
    expect(cooldownLeft(t0, t0 + RESEND_COOLDOWN_S * 1000)).toBe(0);
    expect(cooldownLeft(t0, t0 + 999_999)).toBe(0);
  });

  it("без відправки (null) кулдауну нема", () => {
    expect(cooldownLeft(null, t0)).toBe(0);
  });
});

describe("isSignupOfExistingEmail", () => {
  // Коли підтвердження пошти увімкнено, signUp на вже зареєстрований email
  // повертає «фейкового» користувача без identities і не шле листа.
  it("користувач без identities → email уже існує", () => {
    expect(isSignupOfExistingEmail({ identities: [] })).toBe(true);
  });

  it("справжній новий користувач має identities", () => {
    expect(isSignupOfExistingEmail({ identities: [{ id: "x" }] })).toBe(false);
  });

  it("null/відсутні identities не вважаємо існуючим (не блокуємо флоу)", () => {
    expect(isSignupOfExistingEmail(null)).toBe(false);
    expect(isSignupOfExistingEmail({})).toBe(false);
  });
});
