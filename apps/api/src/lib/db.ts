import { PrismaClient } from "@prisma/client";

/** Single Prisma client for the API process (ingest auth, read routes, metering). */
export const prisma = new PrismaClient();
