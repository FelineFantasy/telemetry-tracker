import { marketingJsonLd } from "@/lib/marketing-json-ld";

export function MarketingJsonLd() {
  const payload = marketingJsonLd();
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
