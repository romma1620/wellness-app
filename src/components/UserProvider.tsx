"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * uid приходить із серверного layout, який уже перевірив сесію.
 * Клієнтські компоненти беруть його звідси замість supabase.auth.getUser():
 * той ходить у мережу на кожен виклик і робив кожен таб на 1–5 запитів довшим.
 */
const Ctx = createContext<string | null>(null);

export function UserProvider({ uid, children }: { uid: string; children: ReactNode }) {
  return <Ctx.Provider value={uid}>{children}</Ctx.Provider>;
}

export function useUid(): string {
  const uid = useContext(Ctx);
  if (!uid) throw new Error("useUid must be used within UserProvider");
  return uid;
}
