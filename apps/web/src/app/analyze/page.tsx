import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { AnalyzeApp } from "@/components/analyze/AnalyzeApp";

export const metadata: Metadata = { title: "Analyze your messages" };

export default function AnalyzePage() {
  return (
    <>
      <SiteHeader cta={false} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <AnalyzeApp />
      </main>
      <SiteFooter />
    </>
  );
}
