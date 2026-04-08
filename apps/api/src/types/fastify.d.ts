import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by ingest auth `preHandler` after successful API key verification or dev bypass. */
    ingestProjectId?: string;
    /** Set when verified via API key; `null`/`undefined` means no per-app restriction. */
    ingestApiKeyAllowedApp?: string | null;
  }
}
