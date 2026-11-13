// Finishes email-link sign-in, sign-up confirmation and Google sign-in:
// exchanges the one-time code for a session cookie, then continues to `next`.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/reports";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/reports"; // same-site only
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/signin?error=link`);
}
