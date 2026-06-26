/**
 * Public dashboard origin for SEO (metadataBase, sitemap, robots).
 * Set `NEXT_PUBLIC_SITE_URL` in production — no trailing slash, e.g. `https://telemetry.example.com`.
 */
export function siteUrlFromEnv(): URL | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  try {
    const normalized = raw.endsWith("/") ? raw.slice(0, -1) : raw;
    return new URL(normalized);
  } catch {
    return null;
  }
}

/** Railway: public hostname once a domain is attached (no protocol in docs). */
function railwayPublicOrigin(): URL | null {
  const d = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (!d) return null;
  const withProto = d.includes("://") ? d : `https://${d}`;
  try {
    return new URL(withProto);
  } catch {
    return null;
  }
}

/** Vercel preview / production (no protocol). */
function vercelOrigin(): URL | null {
  const v = process.env.VERCEL_URL?.trim();
  if (!v) return null;
  try {
    return new URL(v.includes("://") ? v : `https://${v}`);
  } catch {
    return null;
  }
}

/**
 * Prefer `NEXT_PUBLIC_SITE_URL`, then `RAILWAY_PUBLIC_DOMAIN`, then `VERCEL_URL`,
 * then localhost in development only.
 */
export function resolveMetadataBase(): URL | undefined {
  const explicit = siteUrlFromEnv();
  if (explicit) return explicit;
  const rail = railwayPublicOrigin();
  if (rail) return rail;
  const vercel = vercelOrigin();
  if (vercel) return vercel;
  if (process.env.NODE_ENV === "development") {
    return new URL("http://localhost:3000");
  }
  return undefined;
}

/**
 * Canonical origin for sitemap / robots (no trailing slash).
 * Uses the same sources as metadataBase except the layout’s localhost fallback.
 */
export function siteOriginForSeo(): string | undefined {
  const u = siteUrlFromEnv() ?? railwayPublicOrigin() ?? vercelOrigin();
  if (u) return u.origin;
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return undefined;
}
