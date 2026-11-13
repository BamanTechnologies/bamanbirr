import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { ReportsHome } from "@/components/account/ReportsHome";

export const metadata: Metadata = { title: "My reports" };

export default function ReportsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6"><ReportsHome /></main>
      <SiteFooter />
    </>
  );
}
