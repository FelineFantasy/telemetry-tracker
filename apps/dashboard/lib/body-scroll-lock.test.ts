import { afterEach, describe, expect, it } from "vitest";
import { acquireBodyScrollLock, resetBodyScrollLockForTests } from "./body-scroll-lock";

describe("acquireBodyScrollLock", () => {
  afterEach(() => {
    document.body.style.overflow = "";
    resetBodyScrollLockForTests();
  });

  it("locks body scroll while active and restores on release", () => {
    document.body.style.overflow = "auto";
    const release = acquireBodyScrollLock();
    expect(document.body.style.overflow).toBe("hidden");
    release();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("keeps scroll locked until all nested locks release", () => {
    document.body.style.overflow = "";
    const releaseNav = acquireBodyScrollLock();
    const releaseDocs = acquireBodyScrollLock();
    expect(document.body.style.overflow).toBe("hidden");
    releaseNav();
    expect(document.body.style.overflow).toBe("hidden");
    releaseDocs();
    expect(document.body.style.overflow).toBe("");
  });

  it("ignores duplicate releases", () => {
    document.body.style.overflow = "auto";
    const release = acquireBodyScrollLock();
    release();
    release();
    expect(document.body.style.overflow).toBe("auto");
  });
});
