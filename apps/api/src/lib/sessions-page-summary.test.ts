import { Prisma } from "@prisma/client";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  BOUNCE_MAX_DURATION_SECONDS,
  buildSessionListFilter,
  computeAvgDurationPerUserSec,
  identityFirstSeenWhereSql,
  parseSessionsMetricsAnchor,
  resolveSessionIdentity,
  resolveSessionListStartedAtBounds,
  resolveSessionsSummaryWindow,
  sessionFilterSql,
  sessionWindowWithEventScope,
} from "./sessions-page-summary.js";
import { UNKNOWN_RELEASE_KEY } from "./release-key.js";

function prismaSqlText(fragment: Prisma.Sql): string {
  const parts = fragment as unknown as { strings: string[] };
  return parts.strings.join("?");
}

describe("parseSessionsMetricsAnchor", () => {
  it("parses ISO metricsUntil", () => {
    const iso = "2026-06-28T12:00:00.000Z";
    expect(parseSessionsMetricsAnchor(iso).toISOString()).toBe(iso);
  });

  it("falls back to now when metricsUntil is missing or invalid", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-28T12:00:00.000Z"));
    expect(parseSessionsMetricsAnchor(undefined).toISOString()).toBe(
      "2026-06-28T12:00:00.000Z"
    );
    vi.useRealTimers();
  });
});

describe("resolveSessionsSummaryWindow", () => {
  const anchor = new Date("2026-06-28T12:00:00.000Z");
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to last 7 days when range is all-time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(anchor);
    const w = resolveSessionsSummaryWindow({}, anchor);
    expect(w.until).toEqual(anchor);
    expect(w.since.getTime()).toBe(anchor.getTime() - sevenDaysMs);
    expect(w.label).toBe("Last 7 days");
    vi.useRealTimers();
  });

  it("defaults to last 7 days ending at upper bound when range has no lower bound", () => {
    vi.useFakeTimers();
    vi.setSystemTime(anchor);
    const until = new Date("2026-06-28T00:00:00.000Z");
    const w = resolveSessionsSummaryWindow({ lte: until }, anchor);
    expect(w.until).toEqual(until);
    expect(w.since.getTime()).toBe(until.getTime() - sevenDaysMs);
    expect(w.label).toBe("Last 7 days");
    expect(w.previousUntil.getTime()).toBe(w.since.getTime());
    expect(w.previousSince.getTime()).toBe(w.since.getTime() - sevenDaysMs);
    vi.useRealTimers();
  });

  it("uses anchor as upper bound when range has only a lower bound", () => {
    const since = new Date("2026-06-01T00:00:00.000Z");
    const w = resolveSessionsSummaryWindow({ gte: since }, anchor);
    expect(w.since).toEqual(since);
    expect(w.until).toEqual(anchor);
    expect(w.label).toBe("Selected period");
  });

  it("uses explicit range bounds", () => {
    const since = new Date("2026-06-01T00:00:00.000Z");
    const until = new Date("2026-06-08T00:00:00.000Z");
    const w = resolveSessionsSummaryWindow({ gte: since, lte: until });
    expect(w.since).toEqual(since);
    expect(w.until).toEqual(until);
    expect(w.label).toBe("Selected period");
  });
});

describe("resolveSessionListStartedAtBounds", () => {
  const anchor = new Date("2026-06-28T12:00:00.000Z");
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  it("applies default 7-day window for all-time list filters", () => {
    const bounds = resolveSessionListStartedAtBounds({}, anchor);
    expect(bounds.lte).toEqual(anchor);
    expect(bounds.gte.getTime()).toBe(anchor.getTime() - sevenDaysMs);
  });

  it("applies 7-day window ending at upper bound when only to is set", () => {
    const until = new Date("2026-06-20T00:00:00.000Z");
    const bounds = resolveSessionListStartedAtBounds({ lte: until }, anchor);
    expect(bounds.lte).toEqual(until);
    expect(bounds.gte.getTime()).toBe(until.getTime() - sevenDaysMs);
  });

  it("uses explicit range bounds unchanged", () => {
    const since = new Date("2026-06-01T00:00:00.000Z");
    const until = new Date("2026-06-08T00:00:00.000Z");
    const bounds = resolveSessionListStartedAtBounds({ gte: since, lte: until }, anchor);
    expect(bounds).toEqual({ gte: since, lte: until });
  });
});

describe("BOUNCE_MAX_DURATION_SECONDS", () => {
  it("is 10 seconds", () => {
    expect(BOUNCE_MAX_DURATION_SECONDS).toBe(10);
  });
});

describe("computeAvgDurationPerUserSec", () => {
  it("returns total session time divided by distinct users", () => {
    expect(computeAvgDurationPerUserSec(300, 2)).toBe(150);
  });

  it("returns 0 when there are no users", () => {
    expect(computeAvgDurationPerUserSec(120, 0)).toBe(0);
  });

  it("rounds to the nearest second", () => {
    expect(computeAvgDurationPerUserSec(100, 3)).toBe(33);
  });
});

describe("buildSessionListFilter", () => {
  const range = {
    gte: new Date("2026-06-01T00:00:00.000Z"),
    lte: new Date("2026-06-08T00:00:00.000Z"),
  };

  it("includes optional scope fields when provided", () => {
    const filter = buildSessionListFilter({
      appId: "web",
      platform: "web",
      environment: "production",
      release: "1.2.0",
      country: "US",
      q: "  user-1 ",
      range,
    });
    expect(filter).toEqual({
      appId: "web",
      platform: "web",
      environment: "production",
      release: "1.2.0",
      country: "US",
      q: "user-1",
      range,
    });
  });

  it("omits empty search and unset filters", () => {
    const filter = buildSessionListFilter({ range, q: "   " });
    expect(filter).toEqual({ range });
  });
});

describe("sessionFilterSql", () => {
  it("prefers session environment with effective release when both filters are set", () => {
    const sql = sessionFilterSql("proj-1", {
      range: {},
      environment: "production",
      release: "1.2.0",
    });
    const text = prismaSqlText(sql);
    expect(text).toContain('"s"."environment"');
    expect(text).toContain("COALESCE");
    expect(text).toContain('e."environment" = ?');
    expect(text).toContain('ORDER BY e."created_at" DESC');
    // No NULL-environment fallback when both filters are set (Release Health parity).
    expect(text).not.toContain('"s"."environment" IS NULL');
  });

  it("excludes sessions with known event releases when filtering Unknown", () => {
    const text = prismaSqlText(
      sessionFilterSql("proj-1", { range: {}, release: UNKNOWN_RELEASE_KEY })
    );
    expect(text).toContain("COALESCE");
    expect(text).toContain("IS NULL");
    expect(text).toContain('ORDER BY e."created_at" DESC');
    expect(text).toContain("LIMIT 1");
    // Latest-event subquery is unwindowed (ORDER BY created_at for recency only).
    expect(text).not.toMatch(/e\."created_at" >=/);
    expect(text).not.toMatch(/e\."created_at" <=/);
  });

  it("uses latest-event effective release for known release filters", () => {
    const since = new Date("2026-03-01T00:00:00.000Z");
    const until = new Date("2026-03-15T00:00:00.000Z");
    const text = prismaSqlText(
      sessionFilterSql(
        "proj-1",
        { range: { gte: since, lte: until }, release: "1.2.0" },
        { gte: since, lte: until }
      )
    );
    expect(text).toContain("COALESCE");
    expect(text).toContain('ORDER BY e."created_at" DESC');
    expect(text).toContain("LIMIT 1");
    // Attribution window is all-time — no created_at lower/upper bound on the subquery.
    expect(text).not.toMatch(/e\."created_at" >=/);
    expect(text).not.toMatch(/e\."created_at" <=/);
  });

  it("uses latest-event effective release for known release + environment", () => {
    const since = new Date("2026-03-01T00:00:00.000Z");
    const until = new Date("2026-03-15T00:00:00.000Z");
    const text = prismaSqlText(
      sessionFilterSql(
        "proj-1",
        {
          range: { gte: since, lte: until },
          environment: "production",
          release: "1.2.0",
        },
        { gte: since, lte: until }
      )
    );
    expect(text).toContain('e."environment" = ?');
    expect(text).toContain("COALESCE");
    expect(text).toContain('ORDER BY e."created_at" DESC');
    expect(text).not.toMatch(/e\."created_at" >=/);
    expect(text).not.toMatch(/e\."created_at" <=/);
  });

  it("scopes latest-event fallback by platform when platform + release are set", () => {
    const text = prismaSqlText(
      sessionFilterSql("proj-1", {
        range: {},
        platform: "ios",
        release: "1.2.0",
      })
    );
    expect(text).toContain('s."platform" = ?');
    expect(text).toContain('e."platform" = ?');
    expect(text).toContain("COALESCE");
    expect(text).toContain('ORDER BY e."created_at" DESC');
  });

  it("falls back for blank/whitespace/sentinel session releases on known filters", () => {
    const sql = sessionFilterSql("proj-1", { range: {}, release: "1.2.0" });
    const text = prismaSqlText(sql);
    const values = (sql as unknown as { values: unknown[] }).values;
    // normalizeReleaseKeySql maps blank/sentinel Session.release to NULL before COALESCE.
    expect(text).toContain("COALESCE");
    expect(text).toContain("TRIM");
    expect(text).toContain(`TRIM("s"."release") = ''`);
    expect(values).toContain(UNKNOWN_RELEASE_KEY);
    expect(text).not.toContain('s."release" IS NULL');
  });

  it("scopes known-event exclusion by platform for Unknown + platform", () => {
    const text = prismaSqlText(
      sessionFilterSql("proj-1", {
        range: {},
        platform: "android",
        release: UNKNOWN_RELEASE_KEY,
      })
    );
    expect(text).toContain('s."platform" = ?');
    expect(text).toContain('e."platform" = ?');
    expect(text).toContain("COALESCE");
    expect(text).toContain("IS NULL");
  });

  it("scopes known-event exclusion by environment for Unknown + environment", () => {
    const text = prismaSqlText(
      sessionFilterSql("proj-1", {
        range: {},
        environment: "production",
        release: UNKNOWN_RELEASE_KEY,
      })
    );
    expect(text).toContain('"s"."environment"');
    expect(text).toContain('e."environment" = ?');
    expect(text).toContain("COALESCE");
    expect(text).toContain("IS NULL");
  });

  it("bounds matching events to the metrics window when provided", () => {
    const since = new Date("2026-03-01T00:00:00.000Z");
    const until = new Date("2026-03-15T00:00:00.000Z");
    const text = prismaSqlText(
      sessionFilterSql(
        "proj-1",
        { range: { gte: since, lte: until }, environment: "production" },
        { gte: since, lte: until }
      )
    );

    expect(text).toContain('e."created_at" >=');
    expect(text).toContain('e."created_at" <=');
  });
});

describe("sessionWindowWithEventScope", () => {
  it("prefers session environment with event fallback inside the metrics window", () => {
    const since = new Date("2026-03-01T00:00:00.000Z");
    const until = new Date("2026-03-15T00:00:00.000Z");
    const text = prismaSqlText(
      sessionWindowWithEventScope(
        "proj-1",
        { range: {}, environment: "production" },
        "s",
        since,
        until
      )
    );

    expect(text).toContain('"started_at" >=');
    expect(text).toContain('"started_at" <=');
    expect(text).toContain('"s"."environment"');
    expect(text).toContain('e."created_at" >=');
    expect(text).toContain('e."created_at" <=');
  });

  it("uses an exclusive upper bound for the previous compare window", () => {
    const previousSince = new Date("2026-02-22T00:00:00.000Z");
    const previousUntil = new Date("2026-03-01T00:00:00.000Z");
    const text = prismaSqlText(
      sessionWindowWithEventScope(
        "proj-1",
        { range: {}, environment: "production" },
        "s",
        previousSince,
        previousUntil,
        true
      )
    );

    expect(text).toContain('"started_at" <');
    expect(text).toContain('e."created_at" <');
    expect(text).not.toContain('e."created_at" <=');
  });
});

describe("resolveSessionIdentity", () => {
  it("prefers user_id over anonymous_id", () => {
    expect(resolveSessionIdentity(" user-1 ", "anon-1")).toEqual({
      kind: "user_id",
      value: "user-1",
    });
  });

  it("falls back to anonymous_id when user_id is blank", () => {
    expect(resolveSessionIdentity("  ", "anon-1")).toEqual({
      kind: "anonymous_id",
      value: "anon-1",
    });
    expect(resolveSessionIdentity(null, "anon-1")).toEqual({
      kind: "anonymous_id",
      value: "anon-1",
    });
  });

  it("returns null when neither identity is set", () => {
    expect(resolveSessionIdentity(null, null)).toBeNull();
    expect(resolveSessionIdentity("  ", undefined)).toBeNull();
  });
});

describe("identityFirstSeenWhereSql", () => {
  it("matches user_id within project", () => {
    const text = prismaSqlText(
      identityFirstSeenWhereSql("proj-1", { kind: "user_id", value: "user-1" })
    );
    expect(text).toContain('"project_id"');
    expect(text).toContain('"user_id"');
    expect(text).not.toContain('"anonymous_id"');
  });

  it("includes linked anonymous_id for user_id identity", () => {
    const text = prismaSqlText(
      identityFirstSeenWhereSql(
        "proj-1",
        { kind: "user_id", value: "user-1" },
        "s",
        "anon-1"
      )
    );
    expect(text).toContain('"user_id"');
    expect(text).toContain('"anonymous_id"');
    expect(text).toContain("IS NULL");
  });

  it("matches anonymous_id within project", () => {
    const text = prismaSqlText(
      identityFirstSeenWhereSql("proj-1", {
        kind: "anonymous_id",
        value: "anon-1",
      })
    );
    expect(text).toContain('"project_id"');
    expect(text).toContain('"anonymous_id"');
    expect(text).not.toContain('"user_id"');
  });
});
