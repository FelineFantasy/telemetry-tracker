const logos = [
  "Vercel",
  "Linear",
  "Supabase",
  "Resend",
  "Cal.com",
  "Railway",
  "Liveblocks",
  "Clerk",
];

export function LogoStrip() {
  return (
    <section aria-label="Trusted by" className="border-y border-border bg-surface/30">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-center text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Engineering teams building on Telemetry Tracker
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-y-4 text-center sm:grid-cols-4 lg:grid-cols-8">
          {logos.map((l) => (
            <li
              key={l}
              className="text-base font-medium text-muted-foreground/80 transition-colors hover:text-foreground"
            >
              {l}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
