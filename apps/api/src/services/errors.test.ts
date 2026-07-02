import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  errorGroup: {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
};

import { findOrCreateErrorGroup } from "./errors.js";

describe("findOrCreateErrorGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores release on new groups", async () => {
    prisma.errorGroup.findUnique.mockResolvedValueOnce(null);
    prisma.errorGroup.create.mockResolvedValueOnce({
      id: "eg-1",
      message: "boom",
      app: "web",
      environment: "production",
    });

    await findOrCreateErrorGroup(prisma as never, {
      projectId: "p1",
      fingerprint: "fp",
      message: "boom",
      top_stack: "at foo",
      app: "web",
      environment: "production",
      release: "1.2.0",
    });

    expect(prisma.errorGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ release: "1.2.0" }),
      })
    );
  });

  it("updates release on existing groups when provided", async () => {
    prisma.errorGroup.findUnique.mockResolvedValueOnce({ id: "eg-1" });
    prisma.errorGroup.update.mockResolvedValueOnce({});

    await findOrCreateErrorGroup(prisma as never, {
      projectId: "p1",
      fingerprint: "fp",
      message: "boom",
      top_stack: "at foo",
      app: "web",
      release: "1.2.1",
    });

    expect(prisma.errorGroup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ release: "1.2.1" }),
      })
    );
  });
});
