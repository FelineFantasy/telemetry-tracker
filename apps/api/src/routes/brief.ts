import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { prisma } from "../lib/db.js";
import { requireSessionUser } from "../lib/auth-session.js";
import { readOrganizationIdHeader } from "../lib/http-headers.js";
import {
  parseAcknowledgeBriefRequest,
  workspaceBriefRequestBodySchema,
} from "../lib/brief-contracts.js";
import { authorizeBriefAck } from "../lib/brief-authz.js";
import { getMembershipRoleForOrganization } from "../lib/org-permissions.js";
import {
  upsertBriefAcknowledgements,
  validateAckAgainstBriefMeta,
} from "../lib/brief-ack.js";
import { getBriefServedMetaStore } from "../lib/brief-served-meta.js";
import { getWorkspaceBrief } from "../lib/brief-service.js";

export async function briefRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  app.post("/meta/brief/workspace", async (request, reply) => {
    const session = await requireSessionUser(request, reply);
    if (!session) return;

    const organizationId = readOrganizationIdHeader(request);
    if (!organizationId) {
      return reply.status(400).send({ error: "X-Organization-Id header is required" });
    }

    const parsedBody = workspaceBriefRequestBodySchema.safeParse(request.body ?? {});
    if (!parsedBody.success) {
      return reply.status(400).send({ error: "Invalid request body" });
    }

    const result = await getWorkspaceBrief(
      { prisma },
      {
        userId: session.userId,
        organizationId,
        timezone: parsedBody.data.timezone,
      }
    );

    if (result.status === "forbidden") {
      return reply.status(403).send({ error: "Not a member of this organization" });
    }

    return reply.status(result.httpStatus).send(result);
  });

  app.post("/meta/brief/ack", async (request, reply) => {
    const session = await requireSessionUser(request, reply);
    if (!session) return;

    const organizationId = readOrganizationIdHeader(request);
    if (!organizationId) {
      return reply.status(400).send({ error: "X-Organization-Id header is required" });
    }

    const membership = await getMembershipRoleForOrganization(session.userId, organizationId);
    if (!membership) {
      return reply.status(403).send({ ok: false, error: "forbidden", message: "Forbidden" });
    }

    const parsed = parseAcknowledgeBriefRequest(request.body);
    if (!parsed.ok) {
      return reply.status(400).send({ ok: false, error: "invalid_request", message: parsed.error });
    }

    const meta = getBriefServedMetaStore().get(
      session.userId,
      organizationId,
      parsed.data.requestId
    );
    if (!meta) {
      return reply
        .status(409)
        .send({ ok: false, error: "stale_brief", message: "Brief is no longer available for acknowledgement" });
    }

    const metaCheck = validateAckAgainstBriefMeta(parsed.data, meta);
    if (!metaCheck.ok) {
      return reply
        .status(409)
        .send({ ok: false, error: "stale_brief", message: metaCheck.error });
    }

    const ackAuthz = authorizeBriefAck(meta, organizationId, parsed.data.projects);
    if (!ackAuthz.ok) {
      return reply.status(409).send({
        ok: false,
        error: ackAuthz.code,
        message: ackAuthz.code,
      });
    }

    const projectIds = parsed.data.projects.map((p) => p.projectId);
    const projects = await prisma.project.findMany({
      where: {
        id: { in: projectIds },
        organization_id: organizationId,
        deleted_at: null,
      },
      select: { id: true },
    });
    if (projects.length !== projectIds.length) {
      return reply.status(403).send({ ok: false, error: "forbidden", message: "Forbidden" });
    }

    const updated = await upsertBriefAcknowledgements(
      prisma,
      session.userId,
      parsed.data.projects.map((p) => ({
        projectId: p.projectId,
        acknowledgedThrough: new Date(p.acknowledgedThrough),
      }))
    );

    return reply.status(200).send({ ok: true, updated });
  });
}
