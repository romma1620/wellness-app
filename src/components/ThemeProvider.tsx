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
  const reconciled = useRef(false);

  // Синхронізуємо тему з БД (джерело істини) при першому монтуванні.
  useEffect(() => {
    apply(initialTheme);
    try {
      localStorage.setItem(STORAGE_KEY, initialTheme);
    } catch {
      /* ignore */
    }
    reconciled.current = true;
  }, [initialTheme]);

  const setTheme = useCallback((t: ThemeName) => {
    setThemeState(t);
    apply(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
    setSaving(true);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) {
        setSaving(false);
        return;
      }
      supabase
        .from("profiles")
        .update({ theme: t })
        .eq("id", uid)
        .then(() => setSaving(false));
    });
  }, []);

  return <Ctx.Provider value={{ theme, setTheme, saving }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
