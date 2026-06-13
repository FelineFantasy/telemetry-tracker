import { describe, expect, it, beforeEach } from "vitest";
import { consumeIngestRps, resetIngestRpsBucketsForTests } from "./ingest-project-rps.js";

describe("consumeIngestRps", () => {
  beforeEach(() => {
    resetIngestRpsBucketsForTests();
  });

  it("allows burst up to maxRps then rejects", () => {
    const id = "project-1";
    expect(consumeIngestRps(id, 2)).toBe(true);
    expect(consumeIngestRps(id, 2)).toBe(true);
    expect(consumeIngestRps(id, 2)).toBe(false);
  });

  it("ignores invalid maxRps", () => {
    expect(consumeIngestRps("p2", 0)).toBe(true);
    expect(consumeIngestRps("p2", -1)).toBe(true);
  });
});
