/**
 * Чиста логіка авторизації: переклад помилок Supabase, валідація OTP-коду
 * та кулдаун повторної відправки листа.
 */

/** Мінімальна довжина пароля — має збігатися з налаштуванням у Supabase. */
export const MIN_PASSWORD_LENGTH = 6;

/** Довжина коду з листа (стандартний OTP Supabase). */
export const OTP_LENGTH = 6;

/**
 * Пауза між повторними відправками листа, секунд.
 * Supabase сам не шле частіше ніж раз на хвилину (max_frequency).
 */
export const RESEND_COOLDOWN_S = 60;

export function translateAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (/Invalid login credentials/i.test(msg)) return "Невірний email або пароль";
  if (/already registered/i.test(msg)) return "Такий email уже зареєстровано";
  if (/Email not confirmed/i.test(msg)) return "Спершу підтверди email — введи код із листа";
  if (/token has expired or is invalid|otp.*expired/i.test(msg))
    return "Код невірний або застарів. Перевір його або надішли новий";
  if (/password should be at least/i.test(msg))
    return `Пароль має містити щонайменше ${MIN_PASSWORD_LENGTH} символів`;
  if (/new password should be different/i.test(msg))
    return "Новий пароль має відрізнятися від старого";
  if (/email rate limit/i.test(msg)) return "Забагато листів за короткий час. Спробуй трохи пізніше";
  if (/rate limit|for security purposes/i.test(msg)) return "Забагато спроб. Спробуй трохи пізніше";
  return msg || "Щось пішло не так. Спробуй ще раз";
}

/** Код із листа: рівно 6 цифр. */
export function isValidOtp(code: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code);
}

/**
 * Скільки секунд лишилося до можливості повторної відправки.
 * @param lastSentAt час останньої відправки, ms (null — ще не слали)
 * @param now поточний час, ms
 */
export function cooldownLeft(lastSentAt: number | null, now: number): number {
  if (lastSentAt === null) return 0;
  const left = Math.ceil((lastSentAt + RESEND_COOLDOWN_S * 1000 - now) / 1000);
  return Math.max(0, Math.min(RESEND_COOLDOWN_S, left));
}

/**
 * Коли підтвердження пошти увімкнено, signUp на вже зареєстрований email
 * повертає «фейкового» користувача з порожнім identities і НЕ шле листа
 * (захист від перебору email). Детектимо це, щоб не показувати екран коду,
 * який ніколи не прийде.
 */
export function isSignupOfExistingEmail(user: { identities?: unknown[] | null } | null): boolean {
  return !!user && Array.isArray(user.identities) && user.identities.length === 0;
}
