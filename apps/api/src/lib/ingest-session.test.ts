import { describe, expect, it, vi } from "vitest";
import { findIngestSession } from "./ingest-session.js";

describe("findIngestSession", () => {
  it("matches legacy padded app labels against trimmed ingest labels", async () => {
    const findMany = vi.fn(async () => [
      {
        id: "sess-1",
        app: "  web  ",
        session_id: "abc",
        started_at: new Date("2026-07-01T10:00:00.000Z"),
      },
    ]);
    const prisma = { session: { findMany } };

    const row = await findIngestSession(prisma as never, "project-1", "abc", "web");

    expect(row?.id).toBe("sess-1");
    expect(findMany).toHaveBeenCalledWith({
      where: { project_id: "project-1", session_id: "abc" },
      orderBy: { started_at: "desc" },
    });
  });
});
