"use client";

import { Button, ErrorBanner, FieldLabel, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim() || !password) {
      setError("Введи email і пароль");
      return;
    }
    if (mode === "signup" && password.length < 6) {
      setError("Пароль має містити щонайменше 6 символів");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          setInfo("Перевір пошту — ми надіслали лист для підтвердження.");
          setMode("signin");
        }
      }
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-app flex-col items-center bg-bg px-[30px] pb-10 pt-16">
      <div className="flex h-[74px] w-[74px] items-center justify-center rounded-[26px] bg-primary shadow-[0_14px_30px_-10px_var(--primary)]">
        <span className="text-[38px] font-extrabold leading-none text-white">a</span>
      </div>
      <h1 className="mt-5 text-[30px] font-extrabold tracking-tight">aura</h1>
      <p className="mt-2 text-center text-[14.5px] text-muted">
        Твій мʼякий щоденник тіла
        <br />і здоровʼя
      </p>

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
              setInfo(null);
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

      <form onSubmit={handleSubmit} className="mt-6 flex w-full flex-col gap-[14px]">
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
        {info && (
          <div className="rounded-[14px] border-[1.5px] border-primary-light bg-primary-light/40 px-4 py-3 text-[13px] font-bold text-primary">
            {info}
          </div>
        )}

        <Button type="submit" loading={loading} className="mt-3">
          {mode === "signin" ? "Увійти" : "Створити акаунт"}
        </Button>
      </form>
    </div>
  );
}

function translateAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/Invalid login credentials/i.test(msg)) return "Невірний email або пароль";
  if (/already registered/i.test(msg)) return "Такий email уже зареєстровано";
  if (/rate limit/i.test(msg)) return "Забагато спроб. Спробуй трохи пізніше";
  if (/Email not confirmed/i.test(msg)) return "Спершу підтверди email за посиланням у листі";
  return msg || "Щось пішло не так. Спробуй ще раз";
}
