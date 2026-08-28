import { AppHeader } from "@/components/AppHeader";
import { QueryProvider } from "@/components/QueryProvider";
import { TabBar } from "@/components/TabBar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { UserProvider } from "@/components/UserProvider";
import { createClient } from "@/lib/supabase/server";
import type { Profile, ThemeName } from "@/lib/types";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Профіль створюється тригером при реєстрації; підстрахуємось.
  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (!profile) {
    const { data: created } = await supabase
      .from("profiles")
      .insert({ id: user.id, name: user.email?.split("@")[0] ?? null })
      .select("*")
      .single<Profile>();
    profile = created ?? null;
  }

  const theme: ThemeName = profile?.theme ?? "peach";

  return (
    <UserProvider uid={user.id}>
      <QueryProvider>
        <ThemeProvider initialTheme={theme}>
          <div className="mx-auto min-h-dvh max-w-app bg-bg">
            <div className="flex flex-col gap-[14px] px-[18px] pb-[130px] pt-[14px]">
              <AppHeader />
              <main>{children}</main>
            </div>
            <TabBar />
          </div>
        </ThemeProvider>
      </QueryProvider>
    </UserProvider>
  );
}
