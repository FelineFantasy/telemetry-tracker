export function computeFingerprint(message, stack) {
    const firstLine = stack?.split("\n")[0]?.trim() ?? "";
    return `${message}\n${firstLine}`;
}
export async function findOrCreateErrorGroup(prisma, data) {
    const existing = await prisma.errorGroup.findUnique({
        where: { fingerprint: data.fingerprint },
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
            environment: data.environment ?? null,
            occurrences: 1,
        },
    });
}
