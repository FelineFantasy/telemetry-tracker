import type { PrismaClient } from "@prisma/client";

export function computeFingerprint(message: string, stack?: string): string {
  const firstLine = stack?.split("\n")[0]?.trim() ?? "";
  return `${message}\n${firstLine}`;
}

export async function findOrCreateErrorGroup(
  prisma: PrismaClient,
  data: {
    projectId: string;
    fingerprint: string;
    message: string;
    top_stack: string | null;
    app: string;
    environment?: string | null;
    release?: string | null;
    platform?: string | null;
  }
): Promise<{ group: { id: string; message: string; app: string; environment: string | null }; isNew: boolean }> {
  const existing = await prisma.errorGroup.findUnique({
    where: {
      project_id_fingerprint: {
        project_id: data.projectId,
        fingerprint: data.fingerprint,
      },
    },
  });
  if (existing) {
    await prisma.errorGroup.update({
      where: { id: existing.id },
      data: {
        occurrences: { increment: 1 },
        last_seen: new Date(),
        ...(data.environment != null && data.environment !== ""
          ? { environment: data.environment }
          : {}),
        ...(data.release != null && data.release !== "" ? { release: data.release } : {}),
        ...(data.platform != null && data.platform !== "" ? { platform: data.platform } : {}),
      },
    });
    return {
      group: {
        id: existing.id,
        message: existing.message,
        app: existing.app,
        environment: existing.environment,
      },
      isNew: false,
    };
  }
  const created = await prisma.errorGroup.create({
    data: {
      project_id: data.projectId,
      fingerprint: data.fingerprint,
      message: data.message,
      top_stack: data.top_stack,
      app: data.app,
      environment: data.environment ?? null,
      release: data.release ?? null,
      platform: data.platform ?? null,
      occurrences: 1,
    },
  });
  return {
    group: {
      id: created.id,
      message: created.message,
      app: created.app,
      environment: created.environment,
    },
    isNew: true,
  };
}
