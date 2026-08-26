"use client";

import { ConfirmCodeScreen } from "@/components/auth/ConfirmCodeScreen";
import { Button, ErrorBanner, FieldLabel, Input } from "@/components/ui";
import { MIN_PASSWORD_LENGTH, isSignupOfExistingEmail, translateAuthError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "signin" | "signup";

/**
 * Кроки авторизації. Окремих роутів нема навмисно: email/пароль мають жити
 * між кроками, а після verifyOtp(recovery) користувач уже має сесію —
 * навігація на інший шлях віддала б його middleware-редіректу на головну
 * до того, як він задасть новий пароль.
 */
type Step = "auth" | "confirm-signup" | "forgot" | "confirm-recovery" | "new-password";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("auth");
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Час відправки останнього листа з кодом (ms) — для кулдауну на екрані коду. */
  const [sentAt, setSentAt] = useState<number | null>(null);
  /** Показати кнопку «Ввести код», коли вхід уперся в непідтверджений email. */
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const supabase = createClient();

  function goHome() {
    router.push("/");
    router.refresh();
  }

  function switchStep(next: Step) {
    setStep(next);
    setError(null);
    setNeedsConfirm(false);
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNeedsConfirm(false);

    if (!email.trim() || !password) {
      setError("Введи email і пароль");
      return;
    }
    if (mode === "signup" && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Пароль має містити щонайменше ${MIN_PASSWORD_LENGTH} символів`);
      return;
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // Непідтверджена пошта — не глухий кут: ведемо на екран коду.
          if (/email not confirmed/i.test(error.message)) setNeedsConfirm(true);
          throw error;
        }
        goHome();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (isSignupOfExistingEmail(data.user)) {
          setError("Такий email уже зареєстровано");
          setMode("signin");
          return;
        }
        if (data.session) {
          goHome();
        } else {
          setSentAt(Date.now());
          switchStep("confirm-signup");
        }
      }
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Введи email");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setSentAt(Date.now());
      switchStep("confirm-recovery");
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleNewPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Пароль має містити щонайменше ${MIN_PASSWORD_LENGTH} символів`);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      goHome();
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  const subtitle = {
    auth: "Твій мʼякий щоденник тіла\nі здоровʼя",
    "confirm-signup": "Підтвердження пошти",
    forgot: "Відновлення пароля",
    "confirm-recovery": "Відновлення пароля",
    "new-password": "Новий пароль",
  }[step];

  return (
    <div className="mx-auto flex min-h-dvh max-w-app flex-col items-center bg-bg px-[30px] pb-10 pt-16">
      <div className="flex h-[74px] w-[74px] items-center justify-center rounded-[26px] bg-primary shadow-[0_14px_30px_-10px_var(--primary)]">
        <span className="text-[38px] font-extrabold leading-none text-white">a</span>
      </div>
      <h1 className="mt-5 text-[30px] font-extrabold tracking-tight">aura</h1>
      <p className="mt-2 whitespace-pre-line text-center text-[14.5px] text-muted">{subtitle}</p>

      {step === "auth" && (
        <>
          {/* Перемикач вхід / реєстрація */}
          <div className="mt-9 flex w-full rounded-2xl bg-primary-light p-[5px]">
            {(
              [
                { m: "signin", label: "Вхід" },
                { m: "signup", label: "Реєстрація" },
              ] as const
            ).map(({ m, label }) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setNeedsConfirm(false);
                }}
                className={
                  "flex-1 rounded-xl py-[11px] text-center text-[14.5px] transition " +
                  (mode === m
                    ? "bg-surface font-extrabold text-ink shadow-soft"
                    : "font-bold text-muted")
                }
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleAuthSubmit} className="mt-6 flex w-full flex-col gap-[14px]">
            <div>
              <FieldLabel>Email</FieldLabel>
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="anya@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Пароль</FieldLabel>
              <Input
                type={show ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                suffix={
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="font-bold text-primary"
                  >
                    {show ? "Сховати" : "Показати"}
                  </button>
                }
              />
            </div>

            {error && <ErrorBanner>{error}</ErrorBanner>}
            {needsConfirm && (
              <Button type="button" variant="ghost" onClick={() => switchStep("confirm-signup")}>
                Ввести код із листа
              </Button>
            )}

            <Button type="submit" loading={loading} className="mt-3">
              {mode === "signin" ? "Увійти" : "Створити акаунт"}
            </Button>

            {mode === "signin" && (
              <button
                type="button"
                onClick={() => switchStep("forgot")}
                className="py-1 text-center text-[13.5px] font-bold text-primary"
              >
                Забув пароль?
              </button>
            )}
          </form>
        </>
      )}

      {step === "confirm-signup" && (
        <div className="mt-9 w-full">
          <ConfirmCodeScreen
            email={email}
            initialSentAt={sentAt}
            onVerify={async (code) => {
              const { error } = await supabase.auth.verifyOtp({
                email,
                token: code,
                type: "signup",
              });
              if (error) throw error;
              goHome();
            }}
            onResend={async () => {
              const { error } = await supabase.auth.resend({ type: "signup", email });
              if (error) throw error;
            }}
            onBack={() => switchStep("auth")}
          />
        </div>
      )}

      {step === "forgot" && (
        <form onSubmit={handleForgotSubmit} className="mt-9 flex w-full flex-col gap-[14px]">
          <p className="text-center text-[14px] font-medium text-muted">
            Введи свій email — надішлемо код
            <br />
            для зміни пароля
          </p>
          <div>
            <FieldLabel>Email</FieldLabel>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="anya@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && <ErrorBanner>{error}</ErrorBanner>}

          <Button type="submit" loading={loading} className="mt-3">
            Надіслати код
          </Button>
          <button
            type="button"
            onClick={() => switchStep("auth")}
            className="py-1 text-center text-[13.5px] font-bold text-muted"
          >
            ← Назад до входу
          </button>
        </form>
      )}

      {step === "confirm-recovery" && (
        <div className="mt-9 w-full">
          <ConfirmCodeScreen
            email={email}
            initialSentAt={sentAt}
            onVerify={async (code) => {
              const { error } = await supabase.auth.verifyOtp({
                email,
                token: code,
                type: "recovery",
              });
              if (error) throw error;
              // Сесія вже є; пароль лишився старим — ведемо задати новий.
              setPassword("");
              switchStep("new-password");
            }}
            // resend для recovery — це повторний resetPasswordForEmail:
            // auth.resend підтримує лише signup та email_change.
            onResend={async () => {
              const { error } = await supabase.auth.resetPasswordForEmail(email);
              if (error) throw error;
            }}
            onBack={() => switchStep("auth")}
          />
        </div>
      )}

      {step === "new-password" && (
        <form onSubmit={handleNewPasswordSubmit} className="mt-9 flex w-full flex-col gap-[14px]">
          <p className="text-center text-[14px] font-medium text-muted">
            Код прийнято! Задай новий пароль
            <br />
            для свого акаунта
          </p>
          <div>
            <FieldLabel>Новий пароль</FieldLabel>
            <Input
              type={show ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              suffix={
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="font-bold text-primary"
                >
                  {show ? "Сховати" : "Показати"}
                </button>
              }
            />
          </div>

          {error && <ErrorBanner>{error}</ErrorBanner>}

          <Button type="submit" loading={loading} className="mt-3">
            Зберегти й увійти
          </Button>
        </form>
      )}
    </div>
  );
}
