import type { Metadata } from "next";
import { Badge } from "@/app/components/ui/shadcn/badge";
import { Button } from "@/app/components/ui/shadcn/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/shadcn/card";
import { Separator } from "@/app/components/ui/shadcn/separator";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

export default function DesignSystemPage() {
  return (
    <main id="main-content" className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Design system</h1>
      <p className="mt-2 text-muted-foreground">
        Internal reference for pulse-beacon tokens and shadcn primitives.
      </p>

      <Separator className="my-10" />

      <section className="space-y-6">
        <h2 className="text-xl font-semibold">Colors</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { name: "background", className: "bg-background border border-border" },
            { name: "surface", className: "bg-surface" },
            { name: "brand", className: "bg-brand" },
            { name: "primary", className: "bg-primary" },
          ].map((swatch) => (
            <div key={swatch.name} className="space-y-2">
              <div className={`h-14 rounded-lg ${swatch.className}`} />
              <p className="font-mono text-xs text-muted-foreground">{swatch.name}</p>
            </div>
          ))}
        </div>
      </section>

      <Separator className="my-10" />

      <section className="space-y-6">
        <h2 className="text-xl font-semibold">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </div>
      </section>

      <Separator className="my-10" />

      <section className="space-y-6">
        <h2 className="text-xl font-semibold">Badges</h2>
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="brand">Brand</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </section>

      <Separator className="my-10" />

      <section className="space-y-6">
        <h2 className="text-xl font-semibold">Card</h2>
        <Card>
          <CardHeader>
            <CardTitle>Overview metric</CardTitle>
            <CardDescription>Example card using design tokens.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="tabular text-3xl font-semibold">12,482</p>
            <p className="mt-1 text-sm text-muted-foreground">Events in the last 24h</p>
          </CardContent>
        </Card>
      </section>

      <Separator className="my-10" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Utilities</h2>
        <div className="relative overflow-hidden rounded-xl border border-border p-8">
          <div aria-hidden className="glow-blue pointer-events-none absolute inset-0 opacity-80" />
          <p className="relative text-sm text-muted-foreground">
            <code className="font-mono text-foreground">.glow-blue</code> +{" "}
            <code className="font-mono text-foreground">.grid-bg</code> marketing backgrounds
          </p>
        </div>
      </section>
    </main>
  );
}
