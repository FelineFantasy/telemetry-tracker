import { describe, expect, it } from "vitest";
import {
  buildErrorHitHref,
  buildEventHitHref,
  buildReleaseHitHref,
  buildSessionHitHref,
  buildUserHitHref,
  buildViewAllErrorsHref,
  buildViewAllEventsHref,
  buildViewAllSessionsHref,
  flattenSearchResults,
  totalSearchHitCount,
  type GlobalSearchResult,
} from "./global-search";
import { UNKNOWN_RELEASE_KEY, type DashboardListScope } from "./overview-scope-url";

const scope: DashboardListScope = {
  app: "web",
  environment: "production",
  platform: null,
  release: null,
  range: "7d",
};

describe("global search link helpers", () => {
  it("builds error detail deep links with scope", () => {
    expect(
      buildErrorHitHref(
        {
          id: "err-1",
          title: "TypeError",
          subtitle: "fp",
          app: "web",
          environment: "production",
          release: null,
          platform: null,
          lastSeenAt: "2026-01-01T00:00:00.000Z",
        },
        scope
      )
    ).toBe("/dashboard/errors/err-1?app=web&environment=production&range=7d");
  });

  it("builds event list deep links", () => {
    expect(
      buildEventHitHref(
        {
          name: "checkout_started",
          title: "checkout_started",
          eventCount: 3,
          lastSeenAt: "2026-01-01T00:00:00.000Z",
        },
        scope
      )
    ).toContain("name=checkout_started");
  });

  it("builds session detail deep links", () => {
    expect(
      buildSessionHitHref(
        {
          id: "sess-db-id",
          sessionId: "s1",
          title: "Session s1",
          subtitle: null,
          userId: null,
          anonymousId: null,
          country: null,
          browser: null,
          platform: null,
          release: null,
          startedAt: "2026-01-01T00:00:00.000Z",
        },
        scope
      )
    ).toBe("/dashboard/sessions/sess-db-id?app=web&environment=production&range=7d");
  });

  it("builds release deep links including Unknown", () => {
    expect(
      buildReleaseHitHref({ releaseKey: UNKNOWN_RELEASE_KEY, title: "Unknown" }, scope)
    ).toContain(`release=${UNKNOWN_RELEASE_KEY}`);
  });

  it("builds user hits as sessions search", () => {
    const href = buildUserHitHref(
      {
        identity: "user_123",
        identityKind: "user",
        title: "user_123",
        subtitle: "Identified user",
      },
      scope
    );
    expect(href).toContain("/dashboard/sessions?");
    expect(href).toContain("q=user_123");
  });

  it("forwards session filters on user hit deep links", () => {
    const href = buildUserHitHref(
      {
        identity: "user_123",
        identityKind: "user",
        title: "user_123",
        subtitle: null,
      },
      scope,
      { browser: "safari", country: "SI", device: "mobile" }
    );
    expect(href).toContain("country=SI");
    expect(href).toContain("q=user_123+safari+mobile");
  });

  it("builds view-all list hrefs from free text + filters", () => {
    const filters = { environment: "production", error: "TypeError" };
    expect(buildViewAllErrorsHref("checkout error:TypeError", scope, filters)).toContain(
      "q=checkout+TypeError"
    );
    expect(buildViewAllEventsHref("checkout_started", scope, {})).toContain(
      "propertiesContains=checkout_started"
    );
    expect(
      buildViewAllSessionsHref("abc user:u1 browser:safari", scope, {
        user: "u1",
        browser: "safari",
        country: "SI",
        device: "mobile",
      })
    ).toMatch(/country=SI/);
    expect(
      buildViewAllSessionsHref("abc", scope, {
        device: "mobile",
      })
    ).toContain("q=abc+mobile");
  });

  it("merges parsed filters into hit deep links", () => {
    const result: GlobalSearchResult = {
      q: "checkout environment:staging",
      parsed: {
        freeText: "checkout",
        freeTextTerms: ["checkout"],
        filters: { environment: "staging" },
        ignoredKeys: [],
      },
      limitPerGroup: 8,
      emptyQuery: false,
      groups: {
        errors: {
          items: [
            {
              id: "e1",
              title: "err",
              subtitle: null,
              app: "web",
              environment: null,
              release: null,
              platform: null,
              lastSeenAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          truncated: false,
        },
        events: { items: [], truncated: false },
        sessions: { items: [], truncated: false },
        releases: { items: [], truncated: false },
        users: { items: [], truncated: false },
      },
    };
    const flat = flattenSearchResults(result, scope);
    expect(flat[0]?.href).toContain("environment=staging");
  });

  it("flattens grouped results for keyboard navigation", () => {
    const result: GlobalSearchResult = {
      q: "checkout",
      parsed: { freeText: "checkout", freeTextTerms: ["checkout"], filters: {}, ignoredKeys: [] },
      limitPerGroup: 8,
      emptyQuery: false,
      groups: {
        errors: {
          items: [
            {
              id: "e1",
              title: "err",
              subtitle: null,
              app: "web",
              environment: null,
              release: null,
              platform: null,
              lastSeenAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          truncated: false,
        },
        events: {
          items: [
            {
              name: "checkout",
              title: "checkout",
              eventCount: 1,
              lastSeenAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          truncated: false,
        },
        sessions: { items: [], truncated: false },
        releases: { items: [], truncated: false },
        users: { items: [], truncated: false },
      },
    };
    const flat = flattenSearchResults(result, scope);
    expect(flat).toHaveLength(2);
    expect(flat[0]?.kind).toBe("error");
    expect(flat[1]?.kind).toBe("event");
    expect(totalSearchHitCount(result)).toBe(2);
  });
});
