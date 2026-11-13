"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/lib/account/useUser";

type Mode = "signin" | "signup";

/** Same-site paths only. Resolve like the browser does ("/\evil.com" and "/\t/evil.com" mean "//evil.com"). */
function safeNext(n: string | null): string {
  if (!n || !n.startsWith("/")) return "/reports";
  try {
    const base = "https://same.site";
    const u = new URL(n, base);
    return u.origin === base ? u.pathname + u.search + u.hash : "/reports";
  } catch { return "/reports"; }
}
const input = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-800";

export function AuthForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const router = useRouter();
  const { sb, user, configured } = useUser();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    params.get("error") ? { kind: "err", text: "That sign-in link has expired or was already used. Please try again." } : null,
  );

  useEffect(() => { if (user) router.replace(next); }, [user, next, router]);

  const site = typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL;
  const callback = `${site}/auth/callback?next=${encodeURIComponent(next)}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sb) return;
    setBusy(true); setMsg(null);
    if (mode === "signin") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) setMsg({ kind: "err", text: error.message });
      else router.replace(next);
    } else {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: callback } });
      if (error) setMsg({ kind: "err", text: error.message });
      else if (data.session) router.replace(next);
      else setMsg({ kind: "ok", text: `Check ${email} — we sent you a link to confirm your account.` });
    }
    setBusy(false);
  }

  async function magicLink() {
    if (!sb || !email) return setMsg({ kind: "err", text: "Enter your email first." });
    setBusy(true); setMsg(null);
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: callback } });
    setMsg(error ? { kind: "err", text: error.message } : { kind: "ok", text: `Check ${email} — we sent you a sign-in link.` });
    setBusy(false);
  }

  async function google() {
    if (!sb) return;
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback } });
    if (error) setMsg({ kind: "err", text: error.message });
  }

  if (!configured) {
    return (
      <div className="rounded-2xl border border-warn/40 bg-surface p-5 text-sm text-ink-2">
        <p className="font-semibold text-ink">Accounts aren’t connected yet</p>
        <p className="mt-1">Add your Supabase project URL and keys to <code>apps/web/.env</code> (see <code>.env.example</code>) and restart the app.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-line bg-surface p-6 shadow-xl shadow-brand-900/5 sm:p-8">
      <div role="tablist" className="grid grid-cols-2 rounded-2xl bg-surface-2 p-1 text-sm">
        {(["signin", "signup"] as Mode[]).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setMsg(null); }}
            className={`rounded-xl py-2 transition ${mode === m ? "bg-surface font-semibold shadow-sm" : "text-ink-2"}`}>
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <button onClick={google} className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl border border-line-strong bg-surface py-2.5 text-[15px] font-medium hover:border-brand-300">
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A11.6 11.6 0 0 0 12 0 12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"/></svg>
        Continue with Google
      </button>
      <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or with email<span className="h-px flex-1 bg-line" /></div>

      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-ink-2">Email</span>
          <input type="email" required autoComplete="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-ink-2">Password</span>
          <input type="password" required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
          {mode === "signup" && <span className="mt-1 block text-[12px] text-muted">At least 8 characters.</span>}
        </label>
        <button disabled={busy} className="w-full rounded-xl bg-brand-600 py-3 text-[15px] font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700 disabled:opacity-60">
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
      {mode === "signin" && (
        <button onClick={magicLink} disabled={busy} className="mt-3 w-full text-center text-[13px] text-brand-600 hover:underline">
          Email me a sign-in link instead
        </button>
      )}
      {msg && (
        <p role="status" className={`mt-4 rounded-xl px-3 py-2 text-[13px] ${msg.kind === "ok" ? "bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200" : "bg-out/10 text-out"}`}>{msg.text}</p>
      )}
    </div>
  );
}
