import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import {
  BRIEF_AI_TOTAL_BUDGET_MS,
  BRIEF_RESPONSE_SCHEMA_VERSION,
  BRIEF_SCHEMA_VERSION,
} from "./brief-constants.js";
import type { BriefSnapshotRequest } from "./brief-contracts.js";
import { postWorkspaceBrief, resolveBriefAiClientConfigFromEnv, type BriefAiClientConfig } from "./brief-client.js";

const PROJECT_ID = "a0000000-0000-4000-8000-000000000001";
const REQUEST_ID = "b0000000-0000-4000-8000-000000000003";
const CONTENT_HASH = "a".repeat(64);
const SECRET = Buffer.alloc(32, 9);

function snapshot(): BriefSnapshotRequest {
  return {
    schemaVersion: BRIEF_SCHEMA_VERSION,
    requestId: REQUEST_ID,
    generatedAt: "2026-07-14T12:00:00.000Z",
    organizationId: "c0000000-0000-4000-8000-000000000004",
    viewer: {},
    projects: [
      {
        projectId: PROJECT_ID,
        projectName: "Alpha",
        projectSlug: "alpha",
        window: {
          since: "2026-07-07T12:00:00.000Z",
          until: "2026-07-14T12:00:00.000Z",
          previousSince: "2026-06-30T12:00:00.000Z",
          previousUntil: "2026-07-07T12:00:00.000Z",
          durationMs: 604800000,
        },
        kpis: {
          errors: { count: 1, previous: 0 },
          events: { count: 1, previous: 0 },
          sessions: { count: 1, previous: 0 },
          activeUsers: { count: 1, previous: 0 },
          errorRatePct: { value: 50, previous: 0 },
        },
        errorGroups: {
          firstSeenInWindow: [],
          byOccurrenceCount: [],
          byAbsoluteDelta: [],
        },
      },
    ],
  };
}

function validResponseBody() {
  return {
    schemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
    requestId: REQUEST_ID,
    generatedAt: "2026-07-14T12:00:00.000Z",
    workspace: { title: "Workspace brief" },
    projects: [
      {
        projectId: PROJECT_ID,
        generatedThrough: "2026-07-14T12:00:00.000Z",
        significance: "none",
        collapsedLabel: "No changes",
      },
    ],
  };
}

async function withMockServer(
  handler: (req: IncomingMessage, res: ServerResponse, body: string) => void | Promise<void>,
  run: (baseUrl: string) => Promise<void>
) {
  const server: Server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString("utf8");
    await handler(req, res, body);
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
}

function clientConfig(baseUrl: string, overrides?: Partial<BriefAiClientConfig>): BriefAiClientConfig {
  return {
    baseUrl,
    secret: SECRET,
    totalBudgetMs: BRIEF_AI_TOTAL_BUDGET_MS,
    maxRetries: 1,
    retryMinRemainingMs: 250,
    ...overrides,
  };
}

describe("postWorkspaceBrief", () => {
  it("sends signed raw body bytes and validates a successful response", async () => {
    await withMockServer(async (req, res, body) => {
      expect(req.method).toBe("POST");
      expect(req.headers["x-telemetry-request-id"]).toBe(REQUEST_ID);
      expect(req.headers["x-telemetry-content-hash"]).toBe(CONTENT_HASH);
      expect(req.headers["x-telemetry-signature"]).toMatch(/^v1=[a-f0-9]{64}$/);
      expect(body).toBe(JSON.stringify(snapshot()));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(validResponseBody()));
    }, async (baseUrl) => {
      const result = await postWorkspaceBrief(snapshot(), CONTENT_HASH, clientConfig(baseUrl));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect((result.response as { requestId: string }).requestId).toBe(REQUEST_ID);
        expect(result.attempts).toBe(1);
      }
    });
  });

  it("retries retryable HTTP failures within the total budget", async () => {
    let hits = 0;
    const timestamps: string[] = [];
    await withMockServer((req, res) => {
      hits += 1;
      timestamps.push(String(req.headers["x-telemetry-timestamp"] ?? ""));
      if (hits === 1) {
        res.writeHead(503);
        res.end("busy");
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(validResponseBody()));
    }, async (baseUrl) => {
      const result = await postWorkspaceBrief(snapshot(), CONTENT_HASH, clientConfig(baseUrl));
      expect(result.ok).toBe(true);
      expect(hits).toBe(2);
      expect(timestamps).toHaveLength(2);
      if (result.ok) expect(result.attempts).toBe(2);
    });
  });

  it("does not retry when the total budget is already exhausted", async () => {
    let hits = 0;
    await withMockServer((_req, res) => {
      hits += 1;
      res.writeHead(503);
      res.end("busy");
    }, async (baseUrl) => {
      const result = await postWorkspaceBrief(
        snapshot(),
        CONTENT_HASH,
        clientConfig(baseUrl, { totalBudgetMs: 50, maxRetries: 1, retryMinRemainingMs: 250 })
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("http_error");
        expect(result.attempts).toBe(1);
      }
      expect(hits).toBe(1);
    });
  });

  it("returns the raw JSON body without validating integrity", async () => {
    await withMockServer((_req, res) => {
      const body = validResponseBody();
      body.requestId = "00000000-0000-4000-8000-000000000099";
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    }, async (baseUrl) => {
      const result = await postWorkspaceBrief(snapshot(), CONTENT_HASH, clientConfig(baseUrl));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect((result.response as { requestId: string }).requestId).toBe(
          "00000000-0000-4000-8000-000000000099"
        );
      }
    });
  });
});

describe("resolveBriefAiClientConfigFromEnv", () => {
  const validSecret = Buffer.alloc(32, 7).toString("base64");

  it("returns a config for a valid URL and secret", () => {
    const resolved = resolveBriefAiClientConfigFromEnv({
      TELEMETRY_AI_BRIEF_URL: "http://127.0.0.1:3100",
      TELEMETRY_AI_BRIEF_SECRET: validSecret,
    });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.config.baseUrl).toBe("http://127.0.0.1:3100");
      expect(resolved.config.secret.length).toBe(32);
    }
  });

  it("classifies a missing URL as unconfigured", () => {
    const resolved = resolveBriefAiClientConfigFromEnv({
      TELEMETRY_AI_BRIEF_SECRET: validSecret,
    });
    expect(resolved).toEqual({ ok: false, code: "unconfigured" });
  });

  it("classifies a missing secret as misconfigured", () => {
    const resolved = resolveBriefAiClientConfigFromEnv({
      TELEMETRY_AI_BRIEF_URL: "http://127.0.0.1:3100",
    });
    expect(resolved).toEqual({
      ok: false,
      code: "misconfigured",
      baseUrl: "http://127.0.0.1:3100",
    });
  });

  it("classifies invalid base64 secrets as misconfigured", () => {
    const resolved = resolveBriefAiClientConfigFromEnv({
      TELEMETRY_AI_BRIEF_URL: "http://127.0.0.1:3100",
      TELEMETRY_AI_BRIEF_SECRET: "not-valid-base64!!!",
    });
    expect(resolved).toEqual({
      ok: false,
      code: "misconfigured",
      baseUrl: "http://127.0.0.1:3100",
    });
  });

  it("classifies short decoded secrets as misconfigured", () => {
    const resolved = resolveBriefAiClientConfigFromEnv({
      TELEMETRY_AI_BRIEF_URL: "http://127.0.0.1:3100",
      TELEMETRY_AI_BRIEF_SECRET: Buffer.alloc(8).toString("base64"),
    });
    expect(resolved).toEqual({
      ok: false,
      code: "misconfigured",
      baseUrl: "http://127.0.0.1:3100",
    });
  });
});
