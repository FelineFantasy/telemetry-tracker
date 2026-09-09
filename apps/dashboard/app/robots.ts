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
        disallow: [
          "/dashboard",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/unsubscribe",
          "/design-system",
          "/api/",
          "/avatar/",
        ],
      },
    ],
    sitemap: origin ? `${origin}/sitemap.xml` : undefined,
    host: origin,
  };
}
