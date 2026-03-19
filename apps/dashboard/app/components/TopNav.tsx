import { Suspense } from "react";
import Link from "next/link";
import { NavLinks } from "./NavLinks";

function NavLinksFallback() {
  return (
    <>
      <Link href="/overview">Overview</Link>
      <Link href="/errors">Errors</Link>
      <Link href="/events">Events</Link>
      <Link href="/sessions">Sessions</Link>
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
