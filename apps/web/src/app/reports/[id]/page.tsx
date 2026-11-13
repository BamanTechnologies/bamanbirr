import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { RunView } from "@/components/account/RunView";

export const metadata: Metadata = { title: "Report" };

export default function RunPage() {
  return (
    <>
      <SiteHeader cta={false} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <Suspense fallback={<div className="shimmer h-72 rounded-3xl" />}><RunView /></Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
