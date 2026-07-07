import { ProductErrorsScreenshot } from "@/app/components/marketing/ProductErrorsScreenshot";
import { SectionHeading } from "./features";

export function ProductShots() {
  return (
    <section id="product" className="relative scroll-mt-28 py-28">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Product"
          title={<>Built to be fast under your fingers.</>}
          subtitle="Filter by app and date range, triage grouped errors from KPIs and trends, then drill into stack traces — without wading through clutter."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-5">
          <div className="rounded-2xl border border-border-strong bg-surface/40 p-1.5 lg:col-span-3">
            <div className="overflow-hidden rounded-xl border border-border">
              <ProductErrorsScreenshot />
            </div>
          </div>

          <div className="grid gap-6 lg:col-span-2">
            <FeatureCard
              kbd="Esc"
              title="Keyboard-friendly"
              desc="Navigate lists, filters and detail views without leaving the keyboard."
            />
            <FeatureCard
              dot
              title="Real-time ingestion"
              desc="New events land in your store immediately — refresh the dashboard to see them."
            />
            <FeatureCard
              code
              title="Filter by URL"
              desc="Share filtered views with your team using app, date range and search params."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  title,
  desc,
  kbd,
  dot,
  code,
}: {
  title: string;
  desc: string;
  kbd?: string;
  dot?: boolean;
  code?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface/40 p-6">
      <div className="flex h-9 items-center gap-2">
        {kbd && (
          <span className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] text-muted-foreground">
            {kbd}
          </span>
        )}
        {dot && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-pulse-dot rounded-full bg-success" />
            <span className="relative h-2 w-2 rounded-full bg-success" />
          </span>
        )}
        {code && (
          <span className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] text-muted-foreground">
            ?app=web
          </span>
        )}
      </div>
      <h3 className="mt-4 text-[15px] font-medium tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}
