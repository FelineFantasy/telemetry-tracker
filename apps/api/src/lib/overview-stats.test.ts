import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildWorkspaceTelemetry,
  computeOverviewHealth,
  errorGroupDetailHref,
  overviewEnvironmentSessionCountSql,
  overviewEnvironmentSessionCountUpperClauses,
  resolveCompareWindow,
} from "./overview-stats.js";
import { UNKNOWN_RELEASE_KEY } from "./release-key.js";

function prismaSqlText(fragment: Prisma.Sql): string {
  return fragment.strings.reduce(
    (acc, part, i) => acc + part + (fragment.values[i] ?? ""),
    ""
  );
}

/** Collapse whitespace so SQL shape assertions stay readable. */
function normalizeSql(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

describe("resolveCompareWindow", () => {
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  it("offsets week-ago comparison for 7d range", () => {
    const until = new Date("2026-06-28T12:00:00.000Z");
    const currentSince = new Date(until.getTime() - sevenDaysMs);
    const { previousSince, previousUntil } = resolveCompareWindow(
      sevenDaysMs,
      "week-ago",
      currentSince,
      until
    );
    const weekAgoEnd = new Date(until.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStart = new Date(weekAgoEnd.getTime() - sevenDaysMs);

    expect(previousUntil?.getTime()).toBe(weekAgoEnd.getTime());
    expect(previousSince.getTime()).toBe(weekAgoStart.getTime());
  });

  it("uses immediately prior window for previous compare on 7d", () => {
    const currentSince = new Date(Date.now() - sevenDaysMs);
    const { previousSince, previousUntil } = resolveCompareWindow(
      sevenDaysMs,
      "previous",
      currentSince
    );

    expect(previousUntil?.getTime()).toBe(currentSince.getTime());
    expect(previousSince.getTime()).toBe(currentSince.getTime() - sevenDaysMs);
  });

  it("anchors previous compare end to the supplied current window start", () => {
    const currentSince = new Date("2026-05-01T12:00:00.000Z");
    const dayMs = 24 * 60 * 60 * 1000;
    const { previousSince, previousUntil } = resolveCompareWindow(
      dayMs,
      "previous",
      currentSince
    );

    expect(previousUntil).toEqual(currentSince);
    expect(previousSince).toEqual(new Date("2026-04-30T12:00:00.000Z"));
  });
});

describe("overviewEnvironmentSessionCountUpperClauses", () => {
  it("uses inclusive scope.until for the current metrics window", () => {
    const since = new Date("2026-03-01T00:00:00.000Z");
    const until = new Date("2026-03-15T00:00:00.000Z");
    const clauses = overviewEnvironmentSessionCountUpperClauses({
      projectId: "proj_1",
      since,
      until,
      environment: "production",
    });

    expect(normalizeSql(prismaSqlText(clauses.session))).toContain(
      'AND s."started_at" <='
    );
    expect(normalizeSql(prismaSqlText(clauses.event))).toContain(
      'AND e."created_at" <='
    );
  });

  it("uses exclusive upper bounds for the previous compare window", () => {
    const previousUntil = new Date("2026-03-01T00:00:00.000Z");
    const clauses = overviewEnvironmentSessionCountUpperClauses(
      {
        projectId: "proj_1",
        since: new Date("2026-02-22T00:00:00.000Z"),
        until: new Date("2026-03-15T00:00:00.000Z"),
        environment: "production",
      },
      previousUntil
    );

    expect(normalizeSql(prismaSqlText(clauses.session))).toContain(
      'AND s."started_at" <'
    );
    expect(normalizeSql(prismaSqlText(clauses.session))).not.toContain("<=");
    expect(normalizeSql(prismaSqlText(clauses.event))).toContain(
      'AND e."created_at" <'
    );
  });
});

describe("overviewEnvironmentSessionCountSql", () => {
  const since = new Date("2026-07-16T02:00:00.000Z");
  const until = new Date("2026-07-17T02:00:00.000Z");
  const previousUntil = since;

  it("keeps AND before session upper bound (Sentry 42601 near s)", () => {
    // Mirrors GET /api/overview?range=24h&environment=development&… compare window.
    const sql = overviewEnvironmentSessionCountSql(
      {
        projectId: "proj_1",
        since,
        until,
        environment: "development",
      },
      previousUntil
    );
    const text = normalizeSql(prismaSqlText(sql));

    // Regression: missing AND produced `... >= <date> s."started_at" < ...` (42601 near "s").
    expect(text).toMatch(/s\."started_at" >= .+ AND s\."started_at" </);
    expect(text).not.toMatch(/started_at" >=\s+s\."started_at"/);
    expect(text).toMatch(/e\."created_at" >= .+ AND e\."created_at" </);
    expect(text).not.toMatch(/created_at" >=\s+e\."created_at"/);
    expect(text).toContain('s."environment" =');
  });

  it("keeps AND for inclusive until on the current metrics window", () => {
    const sql = overviewEnvironmentSessionCountSql({
      projectId: "proj_1",
      since,
      until,
      environment: "development",
    });
    const text = normalizeSql(prismaSqlText(sql));

    expect(text).toMatch(/s\."started_at" >= .+ AND s\."started_at" <=/);
    expect(text).toMatch(/e\."created_at" >= .+ AND e\."created_at" <=/);
  });

  it("excludes sessions with known event releases when filtering Unknown", () => {
    const sql = overviewEnvironmentSessionCountSql({
      projectId: "proj_1",
      since,
      until,
      release: UNKNOWN_RELEASE_KEY,
    });
    const text = normalizeSql(prismaSqlText(sql));

    expect(text).toContain("COALESCE");
    expect(text).toContain("IS NULL");
    expect(text).toContain('ORDER BY e."created_at" DESC');
    expect(text).toContain("LIMIT 1");
  });

  it("uses latest-event effective release for known release filters", () => {
    const sql = overviewEnvironmentSessionCountSql({
      projectId: "proj_1",
      since,
      until,
      release: "1.2.0",
    });
    const text = normalizeSql(prismaSqlText(sql));

    expect(text).toContain("COALESCE");
    expect(text).toContain('ORDER BY e."created_at" DESC');
    expect(text).toContain("LIMIT 1");
    // Blank/sentinel session releases normalize to NULL (not only SQL NULL).
    expect(text).toContain("TRIM");
    expect(text).not.toContain('s."release" IS NULL');
  });

  it("uses latest-event effective release for known release + environment", () => {
    const sql = overviewEnvironmentSessionCountSql({
      projectId: "proj_1",
      since,
      until,
      environment: "production",
      release: "1.2.0",
    });
    const text = normalizeSql(prismaSqlText(sql));

    expect(text).toContain('e."environment" =');
    expect(text).toContain("COALESCE");
    expect(text).toContain('ORDER BY e."created_at" DESC');
  });

  it("scopes known-event exclusion by environment for Unknown + environment", () => {
    const sql = overviewEnvironmentSessionCountSql({
      projectId: "proj_1",
      since,
      until,
      environment: "production",
      release: UNKNOWN_RELEASE_KEY,
    });
    const text = normalizeSql(prismaSqlText(sql));

    expect(text).toContain('s."environment" =');
    expect(text).toContain('e."environment" =');
    expect(text).toContain("COALESCE");
    expect(text).toContain("IS NULL");
  });

  it("scopes latest-event fallback by platform when platform + release are set", () => {
    const sql = overviewEnvironmentSessionCountSql({
      projectId: "proj_1",
      since,
      until,
      platform: "ios",
      release: "1.2.0",
    });
    const text = normalizeSql(prismaSqlText(sql));

    expect(text).toContain('s."platform" =');
    expect(text).toContain('e."platform" =');
    expect(text).toContain("COALESCE");
    expect(text).toContain('ORDER BY e."created_at" DESC');
  });

  it("scopes known-event exclusion by platform for Unknown + platform", () => {
    const sql = overviewEnvironmentSessionCountSql({
      projectId: "proj_1",
      since,
      until,
      platform: "android",
      release: UNKNOWN_RELEASE_KEY,
    });
    const text = normalizeSql(prismaSqlText(sql));

    expect(text).toContain('s."platform" =');
    expect(text).toContain('e."platform" =');
    expect(text).toContain("COALESCE");
    expect(text).toContain("IS NULL");
  });
});

describe("errorGroupDetailHref", () => {
  it("includes active app and environment scope in the link", () => {
    expect(
      errorGroupDetailHref("eg_1", {
        app: "web",
        environment: "production",
      })
    ).toBe("/dashboard/errors/eg_1?app=web&environment=production");
  });

  it("includes platform and release scope in the link", () => {
    expect(
      errorGroupDetailHref("eg_1", {
        app: "mobile",
        platform: "ios",
        release: "1.2.0",
      })
    ).toBe("/dashboard/errors/eg_1?app=mobile&platform=ios&release=1.2.0");
  });

  it("includes overview time range in the link", () => {
    expect(
      errorGroupDetailHref("eg_1", {
        app: "web",
        platform: "ios",
        range: "none",
      })
    ).toBe("/dashboard/errors/eg_1?app=web&platform=ios&range=none");
  });

  it("omits query string when no scope filters are set", () => {
    expect(errorGroupDetailHref("eg_1", {})).toBe("/dashboard/errors/eg_1");
  });
});

describe("buildWorkspaceTelemetry", () => {
  it("derives ingest totals and breakdown from precomputed counts", () => {
    expect(buildWorkspaceTelemetry(1000, 50, 3, 2)).toEqual({
      ingestRequests: 1050,
      sdkEventRows: 1000,
      distinctApps: 3,
      distinctSdkVersions: 2,
    });
  });
});

describe("computeOverviewHealth", () => {
  it("marks operational when error rate is low", () => {
    const h = computeOverviewHealth(1000, 5, 900, 10, [
      { t: "2026-01-01T00:00:00.000Z", count: 3600 },
    ]);
    expect(h.status).toBe("operational");
    expect(h.successRatePct).toBeGreaterThan(99);
    expect(h.throughputPerSec).toBe(1);
  });

  it("marks outage when error rate is high", () => {
    const h = computeOverviewHealth(100, 900, 100, 100, [
      { t: "2026-01-01T00:00:00.000Z", count: 100 },
    ]);
    expect(h.status).toBe("outage");
  });

  it("uses daily bucket seconds for 7d throughput", () => {
    const h = computeOverviewHealth(
      1000,
      5,
      900,
      10,
      [{ t: "2026-01-01T00:00:00.000Z", count: 86_400 }],
      86_400
    );
    expect(h.throughputPerSec).toBe(1);
    expect(h.peakThroughputPerSec).toBe(1);
  });
});
