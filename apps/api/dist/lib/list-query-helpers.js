import { Prisma } from "@prisma/client";
import { escapeLikePattern } from "./list-query.js";
export function buildEventWhereSql(params) {
    const parts = [Prisma.sql `TRUE`];
    if (params.appId)
        parts.push(Prisma.sql `app = ${params.appId}`);
    if (params.name)
        parts.push(Prisma.sql `name = ${params.name}`);
    if (params.environment)
        parts.push(Prisma.sql `environment = ${params.environment}`);
    if (params.platform)
        parts.push(Prisma.sql `platform = ${params.platform}`);
    if (params.release)
        parts.push(Prisma.sql `release = ${params.release}`);
    if (params.gte)
        parts.push(Prisma.sql `created_at >= ${params.gte}`);
    if (params.lte)
        parts.push(Prisma.sql `created_at <= ${params.lte}`);
    if (params.propertiesContains?.trim()) {
        const pat = `%${escapeLikePattern(params.propertiesContains.trim())}%`;
        parts.push(Prisma.sql `properties::text ILIKE ${pat}`);
    }
    return Prisma.join(parts, " AND ");
}
