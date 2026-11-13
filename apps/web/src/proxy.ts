// Keeps the Supabase session cookie fresh on every page request (Next 16 "proxy",
// formerly middleware). It only refreshes the session — pages still check the
// user themselves, and the database enforces access with row-level security.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!supabaseConfigured) return response;
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Skip static files, the wasm/pdf workers and images.
  matcher: ["/((?!_next/static|_next/image|vendor/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|wasm|mjs)$).*)"],
};
