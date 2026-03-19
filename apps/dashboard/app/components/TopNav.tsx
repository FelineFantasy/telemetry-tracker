import { Suspense } from "react";
import Link from "next/link";
import { NavLinks } from "./NavLinks";

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

export function TopNav() {
  return (
    <header className="top-nav" role="banner">
      <nav className="nav" aria-label="Main">
        <Suspense fallback={<NavLinksFallback />}>
          <NavLinks />
        </Suspense>
      </nav>
      <p className="top-nav__tagline">
        Internal telemetry: errors, events, and sessions.
      </p>
    </header>
  );
}
