/**
 * Global Search (#494) query parser.
 *
 * Free-text tokens + simple `key:value` filters. No AND/OR/NOT/parentheses.
 * Unrecognized keys are ignored and returned in `ignoredKeys` for UI feedback.
 */

export const GLOBAL_SEARCH_FILTER_KEYS = [
  "environment",
  "release",
  "browser",
  "country",
  "device",
  "platform",
  "error",
  "user",
  "from",
  "to",
  "range",
] as const;

export type GlobalSearchFilterKey = (typeof GLOBAL_SEARCH_FILTER_KEYS)[number];

export type GlobalSearchFilters = Partial<Record<GlobalSearchFilterKey, string>>;

export type ParsedGlobalSearchQuery = {
  /** Original trimmed query string. */
  raw: string;
  /** Free-text terms joined with spaces (order preserved). */
  freeText: string;
  /** Individual free-text tokens. */
  freeTextTerms: string[];
  /** Recognized structured filters (last value wins for duplicate keys). */
  filters: GlobalSearchFilters;
  /** Keys that looked like `key:value` but are not supported. */
  ignoredKeys: string[];
};

const FILTER_KEY_SET = new Set<string>(GLOBAL_SEARCH_FILTER_KEYS);

/** Tokenize on whitespace; keep `key:value` as a single token (value may contain spaces only if quoted — MVP: no quotes). */
function tokenizeSearchQuery(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+/).filter(Boolean);
}

/**
 * Parse a Global Search query string.
 *
 * - `key:value` → structured filter when `key` is supported
 * - unrecognized `key:value` → ignored (listed in `ignoredKeys`); not free text
 * - URL-like tokens (`https://…`, `http://…`) → free text (not unknown filters)
 * - other tokens → free text
 * - bare `key:` with empty value is ignored (empty filters are omitted)
 */
export function parseGlobalSearchQuery(q: string | null | undefined): ParsedGlobalSearchQuery {
  const raw = (q ?? "").trim();
  const tokens = tokenizeSearchQuery(raw);
  const freeTextTerms: string[] = [];
  const filters: GlobalSearchFilters = {};
  const ignoredKeys: string[] = [];
  const seenIgnored = new Set<string>();

  for (const token of tokens) {
    const colon = token.indexOf(":");
    if (colon <= 0) {
      freeTextTerms.push(token);
      continue;
    }
    const key = token.slice(0, colon).toLowerCase();
    const value = token.slice(colon + 1).trim();
    if (!key || !/^[a-z][a-z0-9_]*$/.test(key)) {
      freeTextTerms.push(token);
      continue;
    }
    if (!FILTER_KEY_SET.has(key)) {
      // Schemes like `https://host/path` parse as key=`https`, value=`//host/path`.
      // Keep them as free text so messages/properties/stacks can match the URL.
      if (value.startsWith("//")) {
        freeTextTerms.push(token);
        continue;
      }
      if (!seenIgnored.has(key)) {
        seenIgnored.add(key);
        ignoredKeys.push(key);
      }
      continue;
    }
    if (!value) continue;
    filters[key as GlobalSearchFilterKey] = value;
  }

  return {
    raw,
    freeText: freeTextTerms.join(" "),
    freeTextTerms,
    filters,
    ignoredKeys,
  };
}

export function hasGlobalSearchWork(parsed: ParsedGlobalSearchQuery): boolean {
  return (
    parsed.freeTextTerms.length > 0 ||
    Object.keys(parsed.filters).length > 0
  );
}

/** Merge URL/nav scope with query filters; query filters win for overlapping keys. */
export function mergeGlobalSearchScope(input: {
  parsed: ParsedGlobalSearchQuery;
  appId?: string;
  environment?: string;
  platform?: string;
  release?: string;
  range?: { gte?: Date; lte?: Date };
}): {
  appId?: string;
  environment?: string;
  platform?: string;
  release?: string;
  browser?: string;
  country?: string;
  device?: string;
  error?: string;
  user?: string;
  range: { gte?: Date; lte?: Date };
} {
  const f = input.parsed.filters;
  const out: {
    appId?: string;
    environment?: string;
    platform?: string;
    release?: string;
    browser?: string;
    country?: string;
    device?: string;
    error?: string;
    user?: string;
    range: { gte?: Date; lte?: Date };
  } = {
    range: { ...input.range },
  };

  if (input.appId) out.appId = input.appId;

  const environment = f.environment ?? input.environment;
  if (environment) out.environment = environment;

  const platform = f.platform ?? input.platform;
  if (platform) out.platform = platform;

  const release = f.release ?? input.release;
  if (release) out.release = release;

  if (f.browser) out.browser = f.browser;
  if (f.country) out.country = f.country;
  if (f.device) out.device = f.device;
  if (f.error) out.error = f.error;
  if (f.user) out.user = f.user;

  // Date filters from query override URL range when present.
  if (f.from || f.to || f.range) {
    // Caller applies parseCreatedRange; we only signal via filters.
    // range object is replaced by the route using parseCreatedRange on filter dates.
  }

  return out;
}

/**
 * Device class aliases for `device:` filter (#494).
 * Matches platform / device_os / device_browser with ILIKE patterns.
 */
export function deviceFilterPatterns(device: string): string[] {
  const v = device.trim().toLowerCase();
  if (v === "mobile") return ["%mobile%", "%ios%", "%android%", "%iphone%", "%ipad%"];
  if (v === "desktop") {
    return ["%desktop%", "%web%", "%windows%", "%mac%", "%linux%", "%chrome os%"];
  }
  return [`%${v}%`];
}
