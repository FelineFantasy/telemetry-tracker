import { Suspense } from "react";
import Link from "next/link";
import { NavLinks } from "./NavLinks";

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function NavLinksFallback() {
  return (
    <>
      <Link href="/dashboard/overview" className="nav-link">
        Overview
      </Link>
      <Link href="/dashboard/errors" className="nav-link">
        Errors
      </Link>
      <Link href="/dashboard/events" className="nav-link">
        Events
      </Link>
      <Link href="/dashboard/sessions" className="nav-link">
        Sessions
      </Link>
    </>
  );
}

export function TopNav({ onOpenAppMenu }: { onOpenAppMenu?: () => void }) {
  return (
    <header className="top-nav dashboard-top-nav" role="banner">
      <div className="dashboard-top-nav__bar">
        <div className="dashboard-top-nav__start">
          <button
            type="button"
            className="dashboard-menu-btn"
            onClick={onOpenAppMenu}
            aria-label="Open application menu"
          >
            <MenuIcon />
          </button>
        </div>
        <nav className="nav dashboard-top-nav__nav" aria-label="Main">
          <Suspense fallback={<NavLinksFallback />}>
            <NavLinks />
          </Suspense>
        </nav>
      </div>
      <p className="top-nav__tagline">
        Internal telemetry: errors, events, and sessions.
      </p>
    </header>
  );
}
