"use client";

import { createClient } from "@/lib/supabase/client";
import type { ThemeName } from "@/lib/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface ThemeCtx {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
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

  // Синхронізуємо тему з БД (джерело істини) лише при першому монтуванні:
  // подальші router.refresh() не повинні перетирати вибір користувача.
  useEffect(() => {
    if (reconciled.current) return;
    reconciled.current = true;
    commit(initialTheme);
  }, [initialTheme, commit]);

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

  return <Ctx.Provider value={{ theme, setTheme, saving, error }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
