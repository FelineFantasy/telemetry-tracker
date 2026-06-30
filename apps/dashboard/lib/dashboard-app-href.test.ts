import { describe, expect, it } from "vitest";
import { hrefWithoutAppSearchParam } from "./dashboard-app-href";

describe("hrefWithoutAppSearchParam", () => {
  it("removes app and environment after workspace switch", () => {
    const params = new URLSearchParams("app=web&environment=production&range=7d");
    expect(hrefWithoutAppSearchParam("/dashboard/overview", params)).toBe(
      "/dashboard/overview?range=7d"
    );
  });

  it("preserves path when no query remains", () => {
    const params = new URLSearchParams("app=web&environment=staging");
    expect(hrefWithoutAppSearchParam("/dashboard/errors", params)).toBe("/dashboard/errors");
  });
});
