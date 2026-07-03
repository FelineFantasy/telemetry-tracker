import Link from "next/link";
import { SectionHeading } from "./features";

const guides = [
  {
    title: "Hosted cloud",
    desc: "Register at telemetry-tracker.com, create a project, and send your first event.",
    time: "5 min",
    href: "/docs/hosted-cloud",
  },
  {
    title: "Quickstart",
    desc: "Install an SDK and capture your first event in under a minute.",
    time: "2 min",
    href: "/docs#quickstart",
  },
  {
    title: "Capturing errors",
    desc: "Group, fingerprint and resolve exceptions across your apps.",
    time: "5 min",
    href: "/docs#errors",
  },
  {
    title: "Sessions",
    desc: "Track session start and end events with user context.",
    time: "4 min",
    href: "/docs#sessions",
  },
  {
    title: "Next.js integration",
    desc: "Provider, error boundary, and server-side capture.",
    time: "5 min",
    href: "/docs/nextjs",
  },
  {
    title: "NestJS integration",
    desc: "Init in main.ts, optional request middleware, and trackError in services.",
    time: "5 min",
    href: "/docs/nestjs",
  },
  {
    title: "Vue & Nuxt",
    desc: "Vue 3 SPAs and Nuxt apps with @telemetry-tracker/core.",
    time: "5 min",
    href: "/docs/vue",
  },
  {
    title: "Self-hosting",
    desc: "Run the API and dashboard on your own infrastructure.",
    time: "10 min",
    href: "/docs#self-hosting",
  },
  {
    title: "Platform release notes",
    desc: "What shipped in each API and dashboard version — upgrade paths and changelog.",
    time: "3 min",
    href: "/docs/releases",
  },
];

export function DocsPreview() {
  return (
    <section id="docs" className="relative py-28">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Documentation"
          title={<>Docs written by the people who built it.</>}
          subtitle="Short, opinionated guides. Copy-pasteable code. No fluff."
        />

        <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => (
            <li key={g.title}>
              <Link
                href={g.href}
                className="group flex h-full flex-col justify-between bg-background p-6 transition-colors hover:bg-surface/60"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-[15px] font-medium tracking-tight">{g.title}</h3>
                    <svg
                      viewBox="0 0 16 16"
                      className="h-4 w-4 -translate-x-1 text-muted-foreground transition-transform group-hover:translate-x-0 group-hover:text-foreground"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 3l5 5-5 5" />
                    </svg>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{g.desc}</p>
                </div>
                <div className="mt-6 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {g.time}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
