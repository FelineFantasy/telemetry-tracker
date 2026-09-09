import { resolveMetadataBase } from "@/lib/site-url";

const FALLBACK_ORIGIN = "https://telemetry-tracker.com";

export function marketingSiteOrigin(): string {
  return resolveMetadataBase()?.origin ?? FALLBACK_ORIGIN;
}

/** Organization + SoftwareApplication + WebSite graph for public marketing pages. */
export function marketingJsonLd(origin = marketingSiteOrigin()): Record<string, unknown> {
  const home = `${origin}/`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: "Telemetry Tracker",
        url: home,
        logo: `${origin}/icon.svg`,
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${origin}/#app`,
        name: "Telemetry Tracker",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        url: home,
        description:
          "Capture errors, events and sessions with lightweight SDKs. One fast, developer-first observability platform for modern applications.",
        publisher: { "@id": `${origin}/#organization` },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        name: "Telemetry Tracker",
        url: home,
        publisher: { "@id": `${origin}/#organization` },
      },
    ],
  };
}
