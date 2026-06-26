import type { MetadataRoute } from "next";
import { siteOriginForSeo } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const origin = siteOriginForSeo();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard"],
      },
    ],
    sitemap: origin ? `${origin}/sitemap.xml` : undefined,
  };
}
