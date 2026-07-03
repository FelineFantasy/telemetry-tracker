import type { MetadataRoute } from "next";
import { siteOriginForSeo } from "@/lib/site-url";

/** Resolve public URL at request time (e.g. Railway `RAILWAY_PUBLIC_DOMAIN` after deploy). */
export const dynamic = "force-dynamic";

const PUBLIC_PATHS = [
  "",
  "/docs",
  "/docs/hosted-cloud",
  "/docs/sdk",
  "/docs/dashboard",
  "/docs/nextjs",
  "/docs/node",
  "/docs/nestjs",
  "/docs/nuxt",
  "/docs/vue",
  "/docs/react-native",
  "/contact",
  "/privacy",
  "/terms",
  "/cookies",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOriginForSeo();
  if (!origin) return [];

  const now = new Date();
  return PUBLIC_PATHS.map((path) => ({
    url: `${origin}${path === "" ? "/" : path}`,
    lastModified: now,
    changeFrequency: path === "" ? ("weekly" as const) : ("monthly" as const),
    priority: path === "" ? 1 : path === "/docs" ? 0.9 : 0.75,
  }));
}
