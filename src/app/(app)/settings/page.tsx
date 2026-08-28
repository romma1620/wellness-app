"use client";

import { useTheme } from "@/components/ThemeProvider";
import { ExportSheet } from "@/components/ExportSheet";
import { Icon, type IconName } from "@/components/icons";
import {
  Button,
  Card,
  ErrorBanner,
  FieldLabel,
  FullLoader,
  Input,
  PageTitle,
  SectionLabel,
  Segmented,
  Spinner,
} from "@/components/ui";
import { useProfile } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { useUid } from "@/components/UserProvider";
import { ACCENTS } from "@/lib/theme";
import type { ThemeMode } from "@/lib/theme-mode";
import { cn, parseNum } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Світла" },
  { value: "system", label: "Система" },
  { value: "dark", label: "Темна" },
];

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { theme, setTheme, mode, setMode, error: themeError } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [height, setHeight] = useState("");
  const [target, setTarget] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const profileQ = useProfile();
  const profile = profileQ.data ?? null;
  const loading = profileQ.isPending;
  const error = actionError ?? (profileQ.isError ? "Не вдалося завантажити профіль." : null);

  // Поля форми засіваються зі знімка один раз: фонова ревалідація кешу
  // не має переписувати те, що юзер уже редагує.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || profileQ.data === undefined) return;
    seeded.current = true;
    const p = profileQ.data;
    setName(p?.name ?? "");
    setHeight(p?.height != null ? String(p.height).replace(".", ",") : "");
    setTarget(p?.target_weight != null ? String(p.target_weight).replace(".", ",") : "");
    setAvatarUrl(p?.avatar_url ?? null);
  }, [profileQ.data]);

  async function saveProfile() {
    setSaving(true);
    setActionError(null);
    setSavedMsg(false);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: name.trim() || null,
          height: parseNum(height),
          target_weight: parseNum(target),
        })
        .eq("id", uid);
      if (error) throw error;
      // цільову вагу читають прогноз і цілі
      void queryClient.invalidateQueries({ queryKey: ["profile", uid] });
      void queryClient.invalidateQueries({ queryKey: ["diary", uid] });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
    } catch {
      setActionError("Не вдалося зберегти зміни.");
    } finally {
      setSaving(false);
    }
  }

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setActionError("Обери файл зображення.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setActionError("Файл завеликий (макс. 5 МБ).");
      return;
    }
    setUploading(true);
    setActionError(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${uid}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub.publicUrl;
      const { error: updErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", uid);
      if (updErr) throw updErr;
      setAvatarUrl(url);
      void queryClient.invalidateQueries({ queryKey: ["profile", uid] });
    } catch {
      setActionError("Не вдалося завантажити фото.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-[14px]">
        <PageTitle>Профіль</PageTitle>
        <FullLoader />
      </div>
    );
  }

  // Без імені показуємо порожнє коло, а не заглушку-емодзі.
  const initial = (name || profile?.name || "").trim().charAt(0).toUpperCase();

  return (
    <div className="flex flex-col gap-[14px]">
      <PageTitle>Профіль</PageTitle>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {/* Аватар */}
      <div className="flex flex-col items-center gap-[10px] py-[6px]">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative active:scale-95"
          aria-label="Змінити фото"
        >
          <div className="flex h-[92px] w-[92px] items-center justify-center overflow-hidden rounded-full border border-line bg-[color:color-mix(in_oklab,var(--accent)_16%,var(--surface))] text-[34px] font-medium text-accent">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Аватар" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <span className="absolute -bottom-[2px] -right-[2px] box-border flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-bg bg-accent text-on-accent">
            {uploading ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              <Icon name="camera" size={14} strokeWidth={1.8} />
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="text-[12.5px] font-semibold text-accent"
        >
          Змінити фото
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatar} />
      </div>

      {/* Поля профілю */}
      <Card>
        <div className="flex flex-col gap-3">
          <div>
            <FieldLabel>Імʼя</FieldLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Твоє імʼя" />
          </div>
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <FieldLabel>Зріст</FieldLabel>
              <Input
                inputMode="decimal"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="168"
                suffix="см"
              />
            </div>
            <div>
              <FieldLabel>Цільова вага</FieldLabel>
              <Input
                inputMode="decimal"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="58"
                suffix="кг"
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={saveProfile}
            loading={saving}
            className="mt-[2px] text-[14.5px]"
          >
            {savedMsg ? (
              <>
                <Icon name="check" size={15} strokeWidth={2.2} />
                Збережено
              </>
            ) : (
              "Зберегти"
            )}
          </Button>
        </div>
      </Card>

      {/* Оформлення: акцент + режим */}
      <Card>
        <SectionLabel>Оформлення</SectionLabel>
        {themeError && (
          <div className="mb-3">
            <ErrorBanner>{themeError}</ErrorBanner>
          </div>
        )}
        <div className="flex justify-around">
          {ACCENTS.map((a) => {
            const active = theme === a.value;
            return (
              <button
                key={a.value}
                type="button"
                onClick={() => setTheme(a.value)}
                aria-pressed={active}
                className="flex flex-col items-center gap-2"
              >
                <span
                  className="h-[46px] w-[46px] rounded-full transition-shadow"
                  style={{
                    background: a.hex,
                    boxShadow: active
                      ? `0 0 0 3px var(--surface), 0 0 0 5px ${a.hex}`
                      : "none",
                  }}
                />
                <span
                  className={cn(
                    "text-[11.5px]",
                    active ? "font-bold text-accent" : "font-medium text-muted",
                  )}
                >
                  {a.label}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-[18px]">
          <FieldLabel>Режим</FieldLabel>
          <Segmented variant="outline" options={MODE_OPTIONS} value={mode} onChange={setMode} />
          <p className="mt-2 text-[11px] font-normal text-muted">
            «Система» повторює налаштування пристрою
          </p>
        </div>
      </Card>

      {/* Експорт */}
      <Card>
        <SectionLabel>Експорт даних</SectionLabel>
        <Button type="button" variant="outline" onClick={() => setExportOpen(true)}>
          <Icon name="download" size={16} strokeWidth={1.8} />
          Завантажити CSV
        </Button>
        <p className="mt-[10px] text-center text-[11.5px] font-normal text-muted">
          Щоденник, заміри й тренування одним файлом
        </p>
      </Card>

      {/* Розділи, що не мають своєї вкладки */}
      <SettingsLink
        href="/measurements"
        title="Заміри тіла"
        subtitle="Талія, стегна, груди, нога, рука"
        icon="ruler"
      />
      <SettingsLink
        href="/goals"
        title="Цілі та винагороди"
        subtitle="Сходинки ваги й подарунки за них"
        icon="target"
      />
      <SettingsLink
        href="/cycle"
        title="Цикл"
        subtitle="Календар, симптоми та прогнози"
        icon="cycle"
      />

      {/* Логаут */}
      <Button type="button" variant="danger" onClick={logout}>
        <Icon name="logout" size={15} strokeWidth={1.8} />
        Вийти з акаунта
      </Button>

      <p className="pb-2 text-center text-[10.5px] font-normal uppercase tracking-[.08em] text-muted">
        aura · v2.0
      </p>

      {/* Монтуємо умовно: якщо тримати ExportSheet завжди в дереві, закриття
          не розмонтовує його (Sheet сам лише повертає null), і busy/error/empty
          переживають закриття-відкриття — стара експорт-операція може
          завершитись і закрити щіт, який користувач щойно відкрив заново. */}
      {exportOpen && <ExportSheet open={exportOpen} onClose={() => setExportOpen(false)} />}
    </div>
  );
}

/** Рядок-перехід у розділ, що не має власної вкладки в таб-барі. */
function SettingsLink({
  href,
  title,
  subtitle,
  icon,
}: {
  href: string;
  title: string;
  subtitle: string;
  icon: IconName;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-[13px] rounded-[16px] bg-surface px-4 py-[15px] active:scale-[.99]"
    >
      <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px] bg-primary-light text-accent">
        <Icon name={icon} size={17} strokeWidth={1.8} />
      </span>
      <span className="flex flex-col gap-[1px]">
        <span className="text-[14px] font-semibold">{title}</span>
        <span className="text-[11.5px] font-normal text-muted">{subtitle}</span>
      </span>
      <span className="ml-auto flex text-muted">
        <Icon name="chevronRight" size={16} strokeWidth={1.8} />
      </span>
    </Link>
  );
}
