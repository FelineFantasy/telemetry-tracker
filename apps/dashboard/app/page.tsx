import type { Metadata } from "next";
import { Nav } from "@/app/components/marketing/nav";
import { Hero } from "@/app/components/marketing/hero";
import { LogoStrip } from "@/app/components/marketing/logo-strip";
import { Features } from "@/app/components/marketing/features";
import { Sdks } from "@/app/components/marketing/sdks";
import { ProductShots } from "@/app/components/marketing/product-shots";
import { Pricing } from "@/app/components/marketing/pricing";
import { DocsPreview } from "@/app/components/marketing/docs-preview";
import { Cta } from "@/app/components/marketing/cta";
import { Footer } from "@/app/components/marketing/footer";
import { socialPreviewImage } from "@/lib/social-image";
import { resolveMetadataBase } from "@/lib/site-url";

const homeTitle = "Telemetry Tracker — Observability for teams that ship";
const homeDescription =
  "Capture errors, events and sessions with lightweight SDKs. One fast, developer-first observability platform for modern applications.";

export function generateMetadata(): Metadata {
  const base = resolveMetadataBase() ?? new URL("http://localhost:3000");
  const origin = base.origin;

  return {
    title: { absolute: homeTitle },
    description: homeDescription,
    alternates: { canonical: `${origin}/` },
    openGraph: {
      title: homeTitle,
      description: homeDescription,
      url: `${origin}/`,
      images: [socialPreviewImage],
    },
    twitter: {
      title: homeTitle,
      description: homeDescription,
      images: [socialPreviewImage.url],
    },
  };
}

export default function LandingPage() {
  return (
    <main id="main-content" className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <LogoStrip />
      <Features />
      <Sdks />
      <ProductShots />
      <Pricing />
      <DocsPreview />
      <Cta />
      <Footer />
    </main>
  );
}
