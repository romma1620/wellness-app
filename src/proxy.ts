import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next 16: файл-конвенція "proxy" замінює "middleware".
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Усі шляхи, крім статики та зображень.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
