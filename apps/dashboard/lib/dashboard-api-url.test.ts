import { afterEach, describe, expect, it, vi } from "vitest";

describe("resolveDashboardApiUrl", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function loadResolver(apiBase = "http://localhost:3001") {
    vi.stubEnv("API_URL", apiBase);
    const mod = await import("./dashboard-api-url");
    return mod;
  }

  it("resolves valid relative /api paths against API_BASE_URL", async () => {
    const { resolveDashboardApiUrl } = await loadResolver("http://localhost:3001");
    expect(resolveDashboardApiUrl("/api/errors")).toBe(
      "http://localhost:3001/api/errors"
    );
    expect(resolveDashboardApiUrl("/api/errors?limit=10")).toBe(
      "http://localhost:3001/api/errors?limit=10"
    );
    expect(
      resolveDashboardApiUrl(
        "/api/errors/a0000000-0000-4000-8000-000000000001"
      )
    ).toBe(
      "http://localhost:3001/api/errors/a0000000-0000-4000-8000-000000000001"
    );
  });

  it("rejects absolute and scheme-relative URLs", async () => {
    const { resolveDashboardApiUrl } = await loadResolver();
    expect(() => resolveDashboardApiUrl("https://evil.com/api/x")).toThrow(
      /relative \/api/
    );
    expect(() => resolveDashboardApiUrl("http://localhost/api/x")).toThrow(
      /relative \/api/
    );
    expect(() => resolveDashboardApiUrl("//evil.com/api/x")).toThrow(
      /relative \/api/
    );
  });

  it("rejects path traversal and non-/api destinations", async () => {
    const { resolveDashboardApiUrl } = await loadResolver();
    expect(() => resolveDashboardApiUrl("/api/../admin")).toThrow(/under \/api/);
    expect(() => resolveDashboardApiUrl("/api/foo/../../admin")).toThrow(
      /under \/api/
    );
    expect(() => resolveDashboardApiUrl("../../admin")).toThrow(/relative \/api/);
    expect(() => resolveDashboardApiUrl("/admin")).toThrow(/relative \/api/);
    expect(() => resolveDashboardApiUrl("api/errors")).toThrow(/relative \/api/);
  });

  it("keeps a custom API origin fixed", async () => {
    const { resolveDashboardApiUrl } = await loadResolver(
      "https://api.example.com"
    );
    expect(resolveDashboardApiUrl("/api/meta/projects")).toBe(
      "https://api.example.com/api/meta/projects"
    );
    expect(() =>
      resolveDashboardApiUrl("https://api.example.com/api/meta/projects")
    ).toThrow(/relative \/api/);
  });

  it("preserves an API_URL path prefix", async () => {
    const { resolveDashboardApiUrl } = await loadResolver(
      "https://host.example/prefix"
    );
    expect(resolveDashboardApiUrl("/api/errors")).toBe(
      "https://host.example/prefix/api/errors"
    );
    expect(resolveDashboardApiUrl("/api/errors?limit=10")).toBe(
      "https://host.example/prefix/api/errors?limit=10"
    );
    expect(() => resolveDashboardApiUrl("/api/../admin")).toThrow(/under \/api/);
    expect(() => resolveDashboardApiUrl("/api/foo/../../admin")).toThrow(
      /under \/api/
    );
  });
});

describe("parseDashboardApiResourceId", () => {
  it("accepts UUIDs and rejects traversal / query / fragment", async () => {
    vi.stubEnv("API_URL", "http://localhost:3001");
    const { parseDashboardApiResourceId } = await import("./dashboard-api-url");

    expect(
      parseDashboardApiResourceId("A0000000-0000-4000-8000-000000000001")
    ).toBe("a0000000-0000-4000-8000-000000000001");
    expect(parseDashboardApiResourceId("foo/bar")).toBeNull();
    expect(parseDashboardApiResourceId("?query")).toBeNull();
    expect(parseDashboardApiResourceId("#fragment")).toBeNull();
    expect(parseDashboardApiResourceId("../")).toBeNull();
    expect(parseDashboardApiResourceId("not-a-uuid")).toBeNull();
    expect(
      parseDashboardApiResourceId(
        "a0000000-0000-4000-8000-000000000001/extra"
      )
    ).toBeNull();
  });
});
