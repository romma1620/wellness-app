"use client";

import { Icon } from "@/components/icons";
import Link from "next/link";

/**
 * Кругла 34px кнопка «назад» для підсторінок (заміри, звіт). Це посилання,
 * а не `router.back()`: підсторінку можуть відкрити за прямим лінком, і тоді
 * «назад» має вести в батьківський розділ, а не за межі застосунку.
 */
export function BackLink({ href, label = "Назад" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-line bg-surface text-muted transition active:scale-95"
    >
      <Icon name="chevronLeft" size={15} strokeWidth={1.7} />
    </Link>
  );
}
