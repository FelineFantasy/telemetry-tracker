import type { PrismaClient } from "@prisma/client";

export function computeFingerprint(message: string, stack?: string): string {
  const firstLine = stack?.split("\n")[0]?.trim() ?? "";
  return `${message}\n${firstLine}`;
}

export async function findOrCreateErrorGroup(
  prisma: PrismaClient,
  data: { fingerprint: string; message: string; top_stack: string | null; app: string }
) {
  const existing = await prisma.errorGroup.findUnique({
    where: { fingerprint: data.fingerprint },
  });
  if (existing) {
    await prisma.errorGroup.update({
      where: { id: existing.id },
      data: {
        occurrences: { increment: 1 },
        last_seen: new Date(),
      },
    });
    return existing;
  }
  return prisma.errorGroup.create({
    data: {
      fingerprint: data.fingerprint,
      message: data.message,
      top_stack: data.top_stack,
      app: data.app,
      occurrences: 1,
    },
  });
}
