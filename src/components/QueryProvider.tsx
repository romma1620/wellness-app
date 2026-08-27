"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * Кеш даних між табами. Повернення на таб протягом staleTime показує
 * попередні дані миттєво, без скелетона; застарілі — теж миттєво, але з
 * тихою ревалідацією у фоні.
 *
 * Домовленість про ключі (корінь → що інвалідовувати після запису):
 *   ["diary", uid, ...]        — усе, що читає daily_logs / rewards / profile-цілі
 *   ["workouts", uid, ...]     — тренування, вправи, шаблони, рекорди
 *   ["cycle", uid, ...]        — записи й налаштування циклу
 *   ["measurements", uid]      — заміри
 *   ["profile", uid]           — профіль
 * Запис інвалідовує свій корінь щедро: зайвий рефетч після реального
 * редагування дешевший за застарілий екран.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60_000,
            gcTime: 30 * 60_000,
            retry: 1,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
