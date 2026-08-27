import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const PUBLIC_PATHS = ["/login"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // ВАЖЛИВО: не додавати код між createServerClient та getClaims().
  // getClaims() замість getUser(): при ввімкнених asymmetric signing keys
  // підпис JWT перевіряється локально (JWKS кешується глобально на процес),
  // тож навігація не чекає на круговий запит до Supabase Auth; на legacy
  // HS256-секреті метод сам відкочується до серверної перевірки getUser().
  // Якщо бекенд недоступний — не валимо весь застосунок, вважаємо гостем.
  let user: { id: string } | null = null;
  try {
    const { data } = await supabase.auth.getClaims();
    const sub = data?.claims?.sub;
    user = sub ? { id: sub } : null;
  } catch {
    user = null;
  }

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  // Неавторизований на захищеній сторінці -> /login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Авторизований на /login -> на головну
  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
