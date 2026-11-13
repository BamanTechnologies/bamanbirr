import type { Metadata } from "next";
import { SiteHeader } from "@/components/brand";
import { SaveFlow } from "@/components/account/SaveFlow";

export const metadata: Metadata = { title: "Saving your report" };

export default function SavePage() {
  return (
    <>
      <SiteHeader cta={false} />
      <main className="flex-1 px-4 py-16"><SaveFlow /></main>
    </>
  );
}
