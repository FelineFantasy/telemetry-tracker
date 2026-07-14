import { resolveBriefCircuitOptions } from "./brief-runtime-config.js";

export type BriefCircuitState = "closed" | "open" | "half_open";

export class BriefCircuitBreaker {
  private state: BriefCircuitState = "closed";
  private failureTimestamps: number[] = [];
  private openedAt: number | null = null;
  private probeInFlight = false;

  constructor(
    private readonly options: {
      failureThreshold: number;
      windowMs: number;
      cooldownMs: number;
      now?: () => number;
    }
  ) {}

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }

  private pruneFailures(now: number): void {
    this.failureTimestamps = this.failureTimestamps.filter(
      (ts) => now - ts <= this.options.windowMs
    );
  }

  getState(): BriefCircuitState {
    const now = this.now();
    if (this.state === "open" && this.openedAt !== null) {
      if (now - this.openedAt >= this.options.cooldownMs) {
        this.state = "half_open";
        this.probeInFlight = false;
      }
    }
    return this.state;
  }

  isOpen(): boolean {
    return this.getState() === "open";
  }

  /** Returns true when this request may act as the half-open probe. */
  tryBeginProbe(): boolean {
    if (this.getState() !== "half_open") return false;
    if (this.probeInFlight) return false;
    this.probeInFlight = true;
    return true;
  }

  endProbe(success: boolean): void {
    this.probeInFlight = false;
    if (success) {
      this.state = "closed";
      this.failureTimestamps = [];
      this.openedAt = null;
      return;
    }
    this.state = "open";
    this.openedAt = this.now();
  }

  recordSuccess(): void {
    if (this.getState() === "half_open") {
      this.endProbe(true);
      return;
    }
    this.state = "closed";
    this.failureTimestamps = [];
    this.openedAt = null;
  }

  recordFailure(options?: { immediateOpen?: boolean }): void {
    const now = this.now();
    if (this.getState() === "half_open") {
      this.endProbe(false);
      return;
    }
    this.pruneFailures(now);
    this.failureTimestamps.push(now);
    if (options?.immediateOpen || this.failureTimestamps.length >= this.options.failureThreshold) {
      this.state = "open";
      this.openedAt = now;
      this.probeInFlight = false;
    }
  }

  /** @internal */
  probeActive(): boolean {
    return this.probeInFlight;
  }
}

export type BriefPrivateCallPermission =
  | { allowed: true; probing: boolean }
  | { allowed: false; reason: "circuit_open" };

/**
 * Determine whether the orchestrator may call the private brief service.
 *
 * - closed: allowed
 * - open (before cooldown): blocked
 * - half-open: allowed for exactly one in-flight probe; concurrent callers blocked
 */
export function acquireBriefPrivateCallPermission(
  breaker: BriefCircuitBreaker
): BriefPrivateCallPermission {
  const state = breaker.getState();
  if (state === "open") {
    return { allowed: false, reason: "circuit_open" };
  }
  if (state === "half_open") {
    if (!breaker.tryBeginProbe()) {
      return { allowed: false, reason: "circuit_open" };
    }
    return { allowed: true, probing: true };
  }
  return { allowed: true, probing: false };
}

const breakers = new Map<string, BriefCircuitBreaker>();

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function getBriefCircuitBreaker(
  baseUrl: string,
  env: NodeJS.ProcessEnv = process.env
): BriefCircuitBreaker {
  const key = normalizeBaseUrl(baseUrl);
  let breaker = breakers.get(key);
  if (!breaker) {
    breaker = new BriefCircuitBreaker(resolveBriefCircuitOptions(env));
    breakers.set(key, breaker);
  }
  return breaker;
}

/** @internal Test helper */
export function resetBriefCircuitBreakers(): void {
  breakers.clear();
}
