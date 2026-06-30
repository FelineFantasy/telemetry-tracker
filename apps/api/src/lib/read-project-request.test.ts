import { describe, expect, it } from "vitest";
import type { FastifyRequest } from "fastify";
import { isOrgScopedWithoutProjectHeader } from "./read-project-request.js";

function req(headers: Record<string, string>): FastifyRequest {
  return { headers } as FastifyRequest;
}

describe("isOrgScopedWithoutProjectHeader", () => {
  const orgId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

  it("is true when org header is set and project header is omitted", () => {
    expect(
      isOrgScopedWithoutProjectHeader(
        req({ "x-organization-id": orgId })
      )
    ).toBe(true);
  });

  it("is false when a valid project header is present", () => {
    expect(
      isOrgScopedWithoutProjectHeader(
        req({
          "x-organization-id": orgId,
          "x-project-id": "11111111-2222-3333-4444-555555555555",
        })
      )
    ).toBe(false);
  });

  it("is false when only env fallback would apply (no org header)", () => {
    expect(isOrgScopedWithoutProjectHeader(req({}))).toBe(false);
  });
});
