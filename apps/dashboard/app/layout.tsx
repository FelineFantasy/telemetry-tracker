import type { Metadata } from "next";
import "./globals.css";
import { NavLinks } from "./components/NavLinks";

export const metadata: Metadata = {
  title: "Telemetry Tracker",
  description: "Internal telemetry dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <header className="header">
          <nav className="nav" aria-label="Main">
            <NavLinks />
          </nav>
          <p className="page-context" style={{ padding: "0 var(--space-md) var(--space-sm)", margin: 0 }}>
            Internal telemetry: errors, events, and sessions.
          </p>
        </header>
        <main className="main" id="main-content">{children}</main>
      </body>
    </html>
  );
}
