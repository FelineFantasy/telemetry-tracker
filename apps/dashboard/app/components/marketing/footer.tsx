import Link from "next/link";
import { Logo } from "./logo";

const cols: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "SDKs", href: "/#sdks" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Dashboard", href: "/dashboard/overview" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Hosted cloud", href: "/docs/hosted-cloud" },
      { label: "Next.js SDK", href: "/docs/nextjs" },
      { label: "NestJS", href: "/docs/nestjs" },
      { label: "Vue / Nuxt", href: "/docs/vue" },
      { label: "GitHub", href: "https://github.com/Telemetry-Tracker/telemetry-tracker" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Contact", href: "/contact" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Cookies", href: "/cookies" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Lightweight observability for modern applications. Errors, events and sessions in one
              place.
            </p>
            <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-pulse-dot rounded-full bg-success" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              Self-hosted ready
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.heading}>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {c.heading}
              </p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    {l.href.startsWith("mailto:") || l.href.startsWith("http") ? (
                      <a
                        href={l.href}
                        {...(l.href.startsWith("http")
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        className="text-sm text-foreground/85 hover:text-foreground"
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="text-sm text-foreground/85 hover:text-foreground">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Telemetry Tracker. Built by engineers, for engineers.</p>
          <p className="font-mono">v1.2.0 · {new Date().toISOString().slice(0, 10)}</p>
        </div>
      </div>
    </footer>
  );
}
