import Link from "next/link";

export function DocsTopBar() {
  return (
    <header className="top-nav docs-top-bar" role="banner">
      <nav className="nav" aria-label="Docs navigation">
        <Link href="/dashboard/overview" className="nav-link nav-link--dashboard">
          Go to dashboard
        </Link>
      </nav>
      <p className="top-nav__tagline">SDK and integration docs.</p>
    </header>
  );
}
