import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/brand";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
      <div aria-hidden className="absolute -top-40 left-1/2 -z-10 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-b from-brand-200/60 to-transparent blur-3xl dark:from-brand-800/25" />
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo />
          <h1 className="text-2xl font-semibold tracking-tight">Save and revisit your reports</h1>
          <p className="text-sm text-ink-2">Only your telebirr and CBE messages are stored, and you can delete them any time.</p>
        </div>
        <Suspense fallback={<div className="shimmer h-[420px] rounded-3xl" />}>
          <AuthForm />
        </Suspense>
      </div>
    </main>
  );
}
