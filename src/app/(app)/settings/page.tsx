"use client";

import { useTheme } from "@/components/ThemeProvider";
import { Button, Card, ErrorBanner, FieldLabel, FullLoader, Input, SectionLabel } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { Profile, ThemeName } from "@/lib/types";
import { parseNum } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const THEME_SWATCHES: { value: ThemeName; label: string; color: string }[] = [
  { value: "peach", label: "Peach", color: "#E5906F" },
  { value: "mint", label: "Mint", color: "#5FB89C" },
  { value: "lavender", label: "Lavender", color: "#9384C2" },
  { value: "pink", label: "Pink", color: "#E0759B" },
];

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [height, setHeight] = useState("");
  const [target, setTarget] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (!uid) throw new Error("no-user");
        const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
        const p = (data ?? null) as Profile | null;
        setProfile(p);
        setName(p?.name ?? "");
        setHeight(p?.height != null ? String(p.height).replace(".", ",") : "");
        setTarget(p?.target_weight != null ? String(p.target_weight).replace(".", ",") : "");
        setAvatarUrl(p?.avatar_url ?? null);
      } catch {
        setError("Не вдалося завантажити профіль.");
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  async function saveProfile() {
    setSaving(true);
    setError(null);
    setSavedMsg(false);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("no-user");
      const { error } = await supabase
        .from("profiles")
        .update({
          name: name.trim() || null,
          height: parseNum(height),
          target_weight: parseNum(target),
        })
        .eq("id", uid);
      if (error) throw error;
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
    } catch {
      setError("Не вдалося зберегти зміни.");
    } finally {
      setSaving(false);
    }
  }

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Обери файл зображення.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Файл завеликий (макс. 5 МБ).");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("no-user");
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
    } catch {
      setError("Не вдалося завантажити фото.");
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
      <div className="flex flex-col gap-4">
        <h1 className="px-1 pt-1 text-[22px] font-extrabold">Профіль</h1>
        <FullLoader />
      </div>
    );
  }

  const initial = (name || profile?.name || "🙂").trim().charAt(0).toUpperCase();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="px-1 pt-1 text-[22px] font-extrabold">Профіль</h1>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {/* Аватар */}
      <div className="flex flex-col items-center gap-3 py-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative active:scale-95"
          aria-label="Змінити фото"
        >
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-primary-light text-[36px] font-extrabold text-primary">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Аватар" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-bg bg-primary">
            {uploading ? (
              <span className="aura-spin h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <svg width="15" height="15" viewBox="0 0 22 22" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8.5h3l1.5-2h5L15 8.5h3v9H4z" />
                <circle cx="11" cy="12.5" r="3" />
              </svg>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="text-[13px] font-bold text-primary"
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
          <div className="grid grid-cols-2 gap-3">
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
          <Button type="button" onClick={saveProfile} loading={saving} className="mt-1">
            {savedMsg ? "✓ Збережено" : "Зберегти"}
          </Button>
        </div>
      </Card>

      {/* Тема */}
      <Card>
        <SectionLabel>Тема застосунку</SectionLabel>
        <div className="flex justify-around">
          {THEME_SWATCHES.map((s) => {
            const active = theme === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setTheme(s.value)}
                className="flex flex-col items-center gap-2"
              >
                <span
                  className="h-[52px] w-[52px] rounded-full transition"
                  style={{
                    background: s.color,
                    boxShadow: active
                      ? `0 0 0 3px var(--surface), 0 0 0 6px ${s.color}`
                      : "none",
                  }}
                />
                <span
                  className={
                    active
                      ? "text-[12px] font-extrabold text-primary"
                      : "text-[12px] font-semibold text-muted"
                  }
                >
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Заміри тіла */}
      <Link
        href="/measurements"
        className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-4 active:scale-[.99]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-primary-light text-primary">
          <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7.5h16M3 11h16M3 14.5h16M7 4v4M15 10v4" />
          </svg>
        </span>
        <span className="flex flex-col">
          <span className="text-[15px] font-extrabold">Заміри тіла</span>
          <span className="text-[12.5px] font-semibold text-muted">Талія, стегна, груди, нога, рука</span>
        </span>
        <svg className="ml-auto text-muted" width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5l6 6-6 6" />
        </svg>
      </Link>

      {/* Логаут */}
      <button
        type="button"
        onClick={logout}
        className="rounded-2xl border-[1.5px] border-primary-light bg-surface py-4 text-center text-[15px] font-extrabold text-neg active:scale-[.99]"
      >
        Вийти з акаунта
      </button>

      <p className="pb-2 text-center text-[11px] font-medium text-muted">aura · v1.0</p>
    </div>
  );
}
