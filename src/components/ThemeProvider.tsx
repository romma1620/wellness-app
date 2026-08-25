"use client";

import { createClient } from "@/lib/supabase/client";
import {
  MODE_STORAGE_KEY,
  parseThemeMode,
  resolveMode,
  type ThemeMode,
} from "@/lib/theme-mode";
import type { ThemeName } from "@/lib/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

interface ThemeCtx {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  saving: boolean;
  error: string | null;
}

const Ctx = createContext<ThemeCtx | null>(null);

export const STORAGE_KEY = "aura-theme";

function apply(theme: ThemeName) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
  }
}

function applyMode(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.mode = resolveMode(mode, systemDark);
}

// Режим живе в localStorage (він прив'язаний до пристрою, не до акаунта),
// тож сервер його не знає. Читаємо його як зовнішнє сховище: під час
// гідратації React бере серверний знімок "light" і сам перечитує реальне
// значення одразу після — без розбіжностей розмітки й setState в ефекті.
const MODE_EVENT = "aura-mode-change";

function subscribeMode(cb: () => void) {
  window.addEventListener(MODE_EVENT, cb);
  return () => window.removeEventListener(MODE_EVENT, cb);
}

function readMode(): ThemeMode {
  try {
    return parseThemeMode(localStorage.getItem(MODE_STORAGE_KEY));
  } catch {
    return "light";
  }
}

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: ThemeName;
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState<ThemeName>(initialTheme);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconciled = useRef(false);
  const themeRef = useRef<ThemeName>(initialTheme);

  const commit = useCallback((t: ThemeName) => {
    themeRef.current = t;
    setThemeState(t);
    apply(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const mode = useSyncExternalStore(subscribeMode, readMode, () => "light" as ThemeMode);

  // Синхронізуємо тему з БД (джерело істини) лише при першому монтуванні:
  // подальші router.refresh() не повинні перетирати вибір користувача.
  useEffect(() => {
    if (reconciled.current) return;
    reconciled.current = true;
    commit(initialTheme);
  }, [initialTheme, commit]);

  // Тримаємо data-mode в актуальному стані; поки вибрано «Система»,
  // слухаємо зміни системної теми й перемальовуємось разом із нею.
  useEffect(() => {
    applyMode(mode);
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyMode("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(MODE_EVENT));
  }, []);

  const setTheme = useCallback(
    (t: ThemeName) => {
      const prev = themeRef.current;
      if (t === prev) return;

      commit(t); // оптимістично
      setSaving(true);
      setError(null);

      void (async () => {
        try {
          const supabase = createClient();
          const { data, error: authErr } = await supabase.auth.getUser();
          const uid = data.user?.id;
          if (authErr || !uid) throw authErr ?? new Error("no-user");
          const { error: updErr } = await supabase
            .from("profiles")
            .update({ theme: t })
            .eq("id", uid);
          if (updErr) throw updErr;
        } catch {
          // Відкочуємось, щоб UI не розійшовся з БД і не «стрибнув» пізніше.
          commit(prev);
          setError("Не вдалося зберегти тему.");
        } finally {
          setSaving(false);
        }
      })();
    },
    [commit],
  );

  return (
    <Ctx.Provider value={{ theme, setTheme, mode, setMode, saving, error }}>{children}</Ctx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
