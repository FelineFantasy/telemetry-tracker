import { describe, expect, it } from "vitest";
import { acquireBriefPrivateCallPermission, BriefCircuitBreaker } from "./brief-circuit.js";

describe("BriefCircuitBreaker", () => {
  function breaker(nowMs = 0) {
    let current = nowMs;
    return new BriefCircuitBreaker({
      failureThreshold: 3,
      windowMs: 60_000,
      cooldownMs: 30_000,
      now: () => current,
    });
  }

  it("opens after the failure threshold within the window", () => {
    const cb = breaker();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen()).toBe(false);
    cb.recordFailure();
    expect(cb.isOpen()).toBe(true);
  });

  it("opens immediately on misconfigured failures", () => {
    const cb = breaker();
    cb.recordFailure({ immediateOpen: true });
    expect(cb.isOpen()).toBe(true);
  });

  it("allows only one half-open probe", () => {
    let now = 0;
    const cb = new BriefCircuitBreaker({
      failureThreshold: 3,
      windowMs: 60_000,
      cooldownMs: 30_000,
      now: () => now,
    });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen()).toBe(true);

    now = 31_000;
    expect(cb.getState()).toBe("half_open");
    expect(cb.tryBeginProbe()).toBe(true);
    expect(cb.tryBeginProbe()).toBe(false);
  });

  it("closes on successful probe and clears failures", () => {
    let now = 0;
    const cb = new BriefCircuitBreaker({
      failureThreshold: 3,
      windowMs: 60_000,
      cooldownMs: 30_000,
      now: () => now,
    });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen()).toBe(true);

    now = 31_000;
    expect(cb.getState()).toBe("half_open");
    expect(cb.tryBeginProbe()).toBe(true);
    cb.endProbe(true);
    expect(cb.getState()).toBe("closed");
    expect(cb.isOpen()).toBe(false);
  });

  it("reopens when probe fails", () => {
    let now = 0;
    const cb = new BriefCircuitBreaker({
      failureThreshold: 3,
      windowMs: 60_000,
      cooldownMs: 30_000,
      now: () => now,
    });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    now = 31_000;
    expect(cb.tryBeginProbe()).toBe(true);
    cb.endProbe(false);
    expect(cb.isOpen()).toBe(true);
  });

  it("does not allow concurrent half-open probes", () => {
    let now = 0;
    const cb = new BriefCircuitBreaker({
      failureThreshold: 3,
      windowMs: 60_000,
      cooldownMs: 30_000,
      now: () => now,
    });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    now = 31_000;
    expect(cb.getState()).toBe("half_open");
    expect(cb.tryBeginProbe()).toBe(true);
    expect(cb.tryBeginProbe()).toBe(false);
    expect(cb.tryBeginProbe()).toBe(false);
    cb.endProbe(true);
    expect(cb.getState()).toBe("closed");
  });
});

describe("acquireBriefPrivateCallPermission", () => {
  it("blocks open circuits before cooldown", () => {
    const cb = new BriefCircuitBreaker({
      failureThreshold: 3,
      windowMs: 60_000,
      cooldownMs: 30_000,
    });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(acquireBriefPrivateCallPermission(cb)).toEqual({
      allowed: false,
      reason: "circuit_open",
    });
  });

  it("allows exactly one caller during half-open", () => {
    let now = 0;
    const cb = new BriefCircuitBreaker({
      failureThreshold: 3,
      windowMs: 60_000,
      cooldownMs: 30_000,
      now: () => now,
    });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    now = 31_000;
    expect(acquireBriefPrivateCallPermission(cb)).toEqual({ allowed: true, probing: true });
    expect(acquireBriefPrivateCallPermission(cb)).toEqual({
      allowed: false,
      reason: "circuit_open",
    });
  });

  it("allows normal calls when closed", () => {
    const cb = new BriefCircuitBreaker({
      failureThreshold: 3,
      windowMs: 60_000,
      cooldownMs: 30_000,
    });
    expect(acquireBriefPrivateCallPermission(cb)).toEqual({ allowed: true, probing: false });
  });
});
