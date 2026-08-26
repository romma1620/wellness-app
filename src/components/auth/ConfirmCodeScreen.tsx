"use client";

import { CodeInput } from "@/components/auth/CodeInput";
import { Button, ErrorBanner } from "@/components/ui";
import { cooldownLeft, isValidOtp, translateAuthError } from "@/lib/auth";
import { useEffect, useState } from "react";

/**
 * Екран «введи код з листа». Сам володіє станом коду, помилок і кулдауну
 * повторної відправки; як саме верифікувати код і повторно слати лист —
 * вирішує викликач (signup і recovery роблять це по-різному).
 */
export function ConfirmCodeScreen({
  email,
  initialSentAt,
  onVerify,
  onResend,
  onBack,
}: {
  email: string;
  /** Коли лист уже відправлено (ms) — з цього часу рахуємо кулдаун. */
  initialSentAt: number | null;
  /** Верифікує код; у разі помилки — кидає (текст перекладемо тут). */
  onVerify: (code: string) => Promise<void>;
  /** Повторно шле лист; у разі помилки — кидає. */
  onResend: () => Promise<void>;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(initialSentAt);
  const [now, setNow] = useState(() => Date.now());

  const left = cooldownLeft(sentAt, now);

  // Тікаємо раз на секунду лише поки кулдаун активний.
  useEffect(() => {
    if (left <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [left]);

  async function verify(c: string) {
    if (!isValidOtp(c) || verifying) return;
    setError(null);
    setVerifying(true);
    try {
      await onVerify(c);
    } catch (err) {
      setError(translateAuthError(err));
      setCode("");
    } finally {
      setVerifying(false);
    }
  }

  async function resend() {
    if (left > 0 || resending) return;
    setError(null);
    setResending(true);
    try {
      await onResend();
      setSentAt(Date.now());
      setNow(Date.now());
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-[14px]">
      <p className="text-center text-[14px] font-medium text-muted">
        Ми надіслали 6-значний код на
        <br />
        <span className="font-extrabold text-ink">{email}</span>
      </p>

      <CodeInput
        value={code}
        onChange={(v) => {
          setCode(v);
          setError(null);
        }}
        onComplete={verify}
        disabled={verifying}
        error={!!error}
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Button
        type="button"
        loading={verifying}
        disabled={!isValidOtp(code)}
        onClick={() => verify(code)}
        className="mt-2"
      >
        Підтвердити
      </Button>

      <button
        type="button"
        onClick={resend}
        disabled={left > 0 || resending}
        className="py-1 text-center text-[13.5px] font-bold text-primary disabled:text-muted"
      >
        {resending
          ? "Надсилаємо…"
          : left > 0
            ? `Надіслати код ще раз (${left} с)`
            : "Надіслати код ще раз"}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="py-1 text-center text-[13.5px] font-bold text-muted"
      >
        ← Назад до входу
      </button>
    </div>
  );
}
