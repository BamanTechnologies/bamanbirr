import Link from "next/link";
import { AccountButton } from "@/components/auth/AccountButton";

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    // Same mark as src/app/icon.svg (the favicon): a "b" whose bowl is a coin with a check in it.
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="bb-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#58aff7" />
          <stop offset="1" stopColor="#1a61ad" />
        </linearGradient>
        <radialGradient id="bb-shine" cx="0.22" cy="0.12" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity=".35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#bb-bg)" />
      <rect width="64" height="64" rx="15" fill="url(#bb-shine)" />
      <path d="M19 12.5v38" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" />
      <circle cx="33.5" cy="38.5" r="12" fill="none" stroke="#fff" strokeWidth="6.5" />
      <path d="M28.1 38.8l3.9 3.9 7-7.6" fill="none" stroke="#fff" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Bamanbirr home">
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight text-ink">
        Baman<span className="text-brand-600">birr</span>
      </span>
    </Link>
  );
}

export function SiteHeader({ cta = true }: { cta?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-page/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-ink-2 md:flex">
          <Link href="/#how" className="hover:text-ink">How it works</Link>
          <Link href="/#features" className="hover:text-ink">Features</Link>
          <Link href="/#privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/#faq" className="hover:text-ink">FAQ</Link>
        </nav>
        <div className="flex items-center gap-3 sm:gap-4">
          <AccountButton />
          {cta && (
            <Link
              href="/analyze"
              className="whitespace-nowrap rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-700"
            >
              <span className="sm:hidden">Analyze</span><span className="hidden sm:inline">Analyze my messages</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-3">
          <Logo />
          <p className="text-sm text-ink-2">Every birr, accounted for. A product of Baman Technologies.</p>
        </div>
        <div className="grid grid-cols-2 gap-x-12 text-sm text-ink-2">
          <Link href="/analyze" className="py-2 hover:text-ink">Analyze</Link>
          <Link href="/#privacy" className="py-2 hover:text-ink">Privacy</Link>
          <Link href="/#how" className="py-2 hover:text-ink">How it works</Link>
          <Link href="/#faq" className="py-2 hover:text-ink">FAQ</Link>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted sm:px-6">
          © Baman Technologies. Bamanbirr is an independent product and is not affiliated with
          Ethio Telecom (telebirr) or the Commercial Bank of Ethiopia.
        </p>
      </div>
    </footer>
  );
}
