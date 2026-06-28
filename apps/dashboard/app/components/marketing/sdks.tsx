"use client";

import { useState } from "react";
import Link from "next/link";
import { SectionHeading } from "./features";

type Sdk = {
  id: string;
  label: string;
  install: string;
  code: string;
  docHref: string;
};

const sdks: Sdk[] = [
  {
    id: "next",
    label: "Next.js",
    install: "pnpm add @tacko/telemetry-next",
    docHref: "/docs/nextjs",
    code: `// app/providers.tsx
import { TelemetryProvider } from "@tacko/telemetry-next";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TelemetryProvider
      apiKey={process.env.NEXT_PUBLIC_TT_API_KEY!}
      endpoint={process.env.NEXT_PUBLIC_TT_ENDPOINT!}
    >
      {children}
    </TelemetryProvider>
  );
}`,
  },
  {
    id: "node",
    label: "Node.js",
    install: "pnpm add @tacko/telemetry-node",
    docHref: "/docs/node",
    code: `import { createNodeHandler } from "@tacko/telemetry-node";

const handler = createNodeHandler({
  apiKey: process.env.TT_API_KEY!,
  endpoint: process.env.TT_ENDPOINT!,
});

app.use(handler.middleware());`,
  },
  {
    id: "web",
    label: "Web / React",
    install: "pnpm add @tacko/telemetry-core",
    docHref: "/docs/sdk",
    code: `import { initTelemetry } from "@tacko/telemetry-core";

initTelemetry({
  apiKey: import.meta.env.VITE_TT_API_KEY,
  endpoint: import.meta.env.VITE_TT_ENDPOINT,
  app: "web",
});`,
  },
  {
    id: "rn",
    label: "React Native",
    install: "pnpm add @tacko/telemetry-react-native",
    docHref: "/docs/react-native",
    code: `import { initTelemetry } from "@tacko/telemetry-react-native";

initTelemetry({
  apiKey: Config.TT_API_KEY,
  endpoint: Config.TT_ENDPOINT,
  app: "mobile",
});`,
  },
];

export function Sdks() {
  const [active, setActive] = useState<Sdk>(sdks[0]!);
  return (
    <section id="sdks" className="relative py-28">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="SDKs"
          title={<>Drop-in for the stack you already use.</>}
          subtitle="Lightweight clients for web, Next.js, Node and React Native — one ingest API, consistent payloads."
        />

        <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-surface/40">
          <div className="flex items-center gap-1 border-b border-border bg-background/40 p-1.5">
            {sdks.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(s)}
                className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                  active.id === s.id
                    ? "bg-surface-elevated text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
            <div className="tabular ml-auto hidden items-center gap-2 pr-2 text-xs text-muted-foreground sm:flex">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />v1.2.0
            </div>
          </div>

          <div className="grid gap-px bg-border md:grid-cols-[1fr_1.4fr]">
            <div className="bg-background p-6">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Install</p>
              <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface px-3 py-2.5 font-mono text-[13px] text-foreground">
                <code>{active.install}</code>
              </pre>
              <p className="mt-6 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Highlights
              </p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {[
                  "Events, errors & sessions",
                  "Batch ingest support",
                  "Anonymous + user ids",
                  "Self-hosted endpoint",
                ].map((h) => (
                  <li key={h} className="flex items-center gap-2">
                    <svg
                      viewBox="0 0 16 16"
                      className="h-3.5 w-3.5 text-brand"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 8.5 6.5 12 13 4.5" />
                    </svg>
                    {h}
                  </li>
                ))}
              </ul>
              <Link href={active.docHref} className="mt-6 inline-block text-sm text-brand hover:underline">
                View {active.label} docs →
              </Link>
            </div>
            <div className="bg-background p-0">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
                <span className="font-mono">{active.id}.example.ts</span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-foreground/90">
                <code>{active.code}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
