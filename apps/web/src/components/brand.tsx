import Link from "next/link";
import { AccountButton } from "@/components/auth/AccountButton";

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="bb-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8ecbfb" />
          <stop offset="1" stopColor="#1f78d6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#bb-g)" />
      {/* a "b" whose bowl is a coin */}
      <path d="M11 7.5v17" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="17.2" cy="18.6" r="5.9" fill="none" stroke="#fff" strokeWidth="2.6" />
      <path d="M17.2 16.2v4.8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".85" />
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
        <div className="flex items-center gap-4">
          <AccountButton />
          {cta && (
            <Link
              href="/analyze"
              className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-700"
            >
              Analyze my messages
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
        <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm text-ink-2">
          <Link href="/analyze" className="hover:text-ink">Analyze</Link>
          <Link href="/#privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/#how" className="hover:text-ink">How it works</Link>
          <Link href="/#faq" className="hover:text-ink">FAQ</Link>
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
