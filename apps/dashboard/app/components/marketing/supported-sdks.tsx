import Link from "next/link";

const sdks = [
  { emoji: "⚛", label: "React", href: "/docs/sdk" },
  { emoji: "▲", label: "Next.js", href: "/docs/nextjs" },
  { emoji: "💚", label: "Vue", href: "/docs/vue" },
  { emoji: "🟢", label: "Nuxt", href: "/docs/nuxt" },
  { emoji: "📱", label: "React Native", href: "/docs/react-native" },
  { emoji: "🟢", label: "Node.js", href: "/docs/node" },
  { emoji: "🛡", label: "NestJS", href: "/docs/nestjs" },
] as const;

export function SupportedSdks() {
  return (
    <section aria-label="Supported SDKs" className="border-y border-border bg-surface/30">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-center text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Supported SDKs
        </p>
        <h2 className="mt-2 text-center text-2xl font-semibold tracking-tight text-foreground">
          Works with your stack
        </h2>
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-7">
          {sdks.map((sdk) => (
            <li key={sdk.label}>
              <Link
                href={sdk.href}
                className="group flex flex-col items-center gap-1.5 text-center transition-colors"
              >
                <span className="text-2xl leading-none" aria-hidden>
                  {sdk.emoji}
                </span>
                <span className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                  {sdk.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          First-class SDKs for modern JavaScript applications.
        </p>
      </div>
    </section>
  );
}
