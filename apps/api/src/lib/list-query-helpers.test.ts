import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildEventWhereSql } from "./list-query-helpers.js";

function prismaSqlText(fragment: Prisma.Sql): string {
  const parts = fragment as unknown as { strings: string[]; values: unknown[] };
  return parts.strings.join("?");
}

describe("buildEventWhereSql", () => {
  it("escapes propertiesContains wildcards for ILIKE", () => {
    const sql = buildEventWhereSql({
      projectId: "proj_1",
      propertiesContains: "100%_done",
    });
    expect(prismaSqlText(sql)).toContain("ESCAPE");
    const parts = sql as unknown as { values: unknown[] };
    expect(parts.values).toContain("%100\\%\\_done%");
  });
});
