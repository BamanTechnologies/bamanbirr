"use client";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/env";

/** The signed-in user (null when signed out, undefined while loading). */
export function useUser() {
  const sb = useMemo(() => (supabaseConfigured ? createClient() : null), []);
  const [user, setUser] = useState<User | null | undefined>(supabaseConfigured ? undefined : null);
  useEffect(() => {
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data } = sb.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, [sb]);
  return { sb, user, configured: supabaseConfigured };
}

/**
 * For pages that need an account. Arriving signed out → sign-in (then back to
 * `next`). Signing out while on the page → the home page, not the sign-in form.
 * While `hold.current` is true the page is navigating away itself (e.g. after
 * deleting the account), so nothing is done here.
 */
export function useRequireUser(user: User | null | undefined, configured: boolean, next: string, hold?: RefObject<boolean>) {
  const router = useRouter();
  const wasSignedIn = useRef(false);
  useEffect(() => {
    if (user) { wasSignedIn.current = true; return; }
    if (!configured || user !== null || hold?.current) return;
    router.replace(wasSignedIn.current ? "/" : `/signin?next=${encodeURIComponent(next)}`);
  }, [user, configured, next, router, hold]);
}
