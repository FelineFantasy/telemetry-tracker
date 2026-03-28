import Link from "next/link";
import { BrandLogo } from "@/app/components/BrandLogo";

const navItems = [
  { href: "#hero", label: "Home" },
  { href: "#preview", label: "Product" },
  { href: "#features", label: "Features" },
  { href: "#workflow", label: "How it works" },
  { href: "#contact", label: "Contact" },
] as const;

export function LandingHeader() {
  return (
    <header className="landing-header">
      <div className="landing-header__bar">
        <Link href="/" className="landing-header__logo">
          <BrandLogo className="landing-header__logo-img" size={40} priority />
          <span>Telemetry Tracker</span>
        </Link>
        <nav className="landing-header__nav" aria-label="Page sections">
          {navItems.map(({ href, label }) => (
            <a key={href} href={href} className="landing-header__link">
              {label}
            </a>
          ))}
        </nav>
        <div className="landing-header__actions">
          <Link href="/docs" className="landing-header__ghost">
            View Docs
          </Link>
          <Link href="/dashboard/overview" className="landing-header__solid">
            Open Dashboard
          </Link>
        </div>
      </div>
    </header>
  );
}
