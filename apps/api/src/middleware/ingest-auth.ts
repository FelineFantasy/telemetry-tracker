import type { FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { verifyIngestApiKey } from "../lib/api-key-auth.js";
import { readProjectIdFromEnv } from "../lib/project-scope.js";

export type IngestAuthFailure = { error: string; status: number };

/**
 * Step 4 — Resolve project for ingest: API key (`Authorization` / `X-API-Key`) or
 * `INGEST_ALLOW_UNAUTHENTICATED=true` + `TELEMETRY_PROJECT_ID` (dev only).
 */
export async function resolveIngestProjectId(
  prisma: PrismaClient,
  request: FastifyRequest
): Promise<
  { projectId: string; allowedApp: string | null | undefined } | IngestAuthFailure
> {
  const verified = await verifyIngestApiKey(prisma, request);
  if (verified) {
    return {
      projectId: verified.projectId,
      allowedApp: verified.allowedApp,
    };
  }
  if (process.env.INGEST_ALLOW_UNAUTHENTICATED === "true") {
    return { projectId: readProjectIdFromEnv(), allowedApp: undefined };
  }
  return {
    error:
      "Missing or invalid API key. Send Authorization: Bearer tt_live_<publicId>_<secret> or X-API-Key with the same value.",
    status: 401,
  };
}

/**
 * Fastify `preHandler`: authenticates ingest, then sets `request.ingestProjectId`.
 * On failure, sends 401/400 and stops the chain.
 */
export function createIngestAuthPreHandler(prisma: PrismaClient) {
  return async function ingestAuthPreHandler(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const result = await resolveIngestProjectId(prisma, request);
    if ("error" in result) {
      await reply.status(result.status).send({ error: result.error });
      return;
    }
    request.ingestProjectId = result.projectId;
    request.ingestApiKeyAllowedApp = result.allowedApp;
  };
}

/** Use in route handlers after ingest auth preHandler (step 5). */
export function requireIngestProjectId(request: FastifyRequest): string {
  const id = request.ingestProjectId;
  if (!id) {
    throw new Error("ingest: missing ingestProjectId (preHandler not registered?)");
  }
  return id;
}
