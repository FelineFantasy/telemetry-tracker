import { Prisma, type Prisma as PrismaTypes } from "@prisma/client";

export type ListOrder = "asc" | "desc";

export function parseListOrderParam(
  v: string | undefined
): { ok: true; order: ListOrder } | { ok: false } {
  if (v === undefined || v === "") return { ok: true, order: "desc" };
  if (v === "asc" || v === "desc") return { ok: true, order: v };
  return { ok: false };
}

/* —— Events list —— */

const EVENT_SORT_FIELDS = [
  "created_at",
  "name",
  "app",
  "environment",
  "platform",
  "release",
] as const;
export type EventListSort = (typeof EVENT_SORT_FIELDS)[number];

export function parseEventListSortParam(
  v: string | undefined
): { ok: true; sort: EventListSort } | { ok: false } {
  if (v === undefined || v === "") return { ok: true, sort: "created_at" };
  if ((EVENT_SORT_FIELDS as readonly string[]).includes(v)) {
    return { ok: true, sort: v as EventListSort };
  }
  return { ok: false };
}

export function eventListOrderBy(
  sort: EventListSort,
  order: ListOrder
): PrismaTypes.EventOrderByWithRelationInput {
  return { [sort]: order };
}

/** Whitelisted column fragments for raw `Event` queries (properties search path). */
export const EVENT_SORT_SQL: Record<EventListSort, Prisma.Sql> = {
  created_at: Prisma.sql`"created_at"`,
  name: Prisma.sql`"name"`,
  app: Prisma.sql`"app"`,
  environment: Prisma.sql`"environment"`,
  platform: Prisma.sql`"platform"`,
  release: Prisma.sql`"release"`,
};

/* —— Sessions list —— */

const SESSION_SORT_FIELDS = [
  "started_at",
  "ended_at",
  "session_id",
  "app",
  "platform",
  "user_id",
] as const;
export type SessionListSort = (typeof SESSION_SORT_FIELDS)[number];

export function parseSessionListSortParam(
  v: string | undefined
): { ok: true; sort: SessionListSort } | { ok: false } {
  if (v === undefined || v === "") return { ok: true, sort: "started_at" };
  if ((SESSION_SORT_FIELDS as readonly string[]).includes(v)) {
    return { ok: true, sort: v as SessionListSort };
  }
  return { ok: false };
}

export function sessionListOrderBy(
  sort: SessionListSort,
  order: ListOrder
): PrismaTypes.SessionOrderByWithRelationInput {
  return { [sort]: order };
}

/* —— Overview: error groups —— */

const OVERVIEW_ERR_SORT = [
  "occurrences",
  "last_seen",
  "first_seen",
  "message",
  "app",
] as const;
export type OverviewErrorSort = (typeof OVERVIEW_ERR_SORT)[number];

export function parseOverviewErrorSortParam(
  v: string | undefined
): { ok: true; sort: OverviewErrorSort } | { ok: false } {
  if (v === undefined || v === "") return { ok: true, sort: "occurrences" };
  if ((OVERVIEW_ERR_SORT as readonly string[]).includes(v)) {
    return { ok: true, sort: v as OverviewErrorSort };
  }
  return { ok: false };
}

export function overviewErrorOrderBy(
  sort: OverviewErrorSort,
  order: ListOrder
): PrismaTypes.ErrorGroupOrderByWithRelationInput {
  return { [sort]: order };
}

/* —— Overview: top event names (groupBy) —— */

export type OverviewTopEventsSort = "count" | "name";

export function parseOverviewTopEventsSortParam(
  v: string | undefined
): { ok: true; sort: OverviewTopEventsSort } | { ok: false } {
  if (v === undefined || v === "") return { ok: true, sort: "count" };
  if (v === "count" || v === "name") return { ok: true, sort: v };
  return { ok: false };
}
