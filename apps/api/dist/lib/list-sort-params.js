import { Prisma } from "@prisma/client";
export function parseListOrderParam(v) {
    if (v === undefined || v === "")
        return { ok: true, order: "desc" };
    if (v === "asc" || v === "desc")
        return { ok: true, order: v };
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
];
export function parseEventListSortParam(v) {
    if (v === undefined || v === "")
        return { ok: true, sort: "created_at" };
    if (EVENT_SORT_FIELDS.includes(v)) {
        return { ok: true, sort: v };
    }
    return { ok: false };
}
export function eventListOrderBy(sort, order) {
    return { [sort]: order };
}
/** Whitelisted column fragments for raw `Event` queries (properties search path). */
export const EVENT_SORT_SQL = {
    created_at: Prisma.sql `"created_at"`,
    name: Prisma.sql `"name"`,
    app: Prisma.sql `"app"`,
    environment: Prisma.sql `"environment"`,
    platform: Prisma.sql `"platform"`,
    release: Prisma.sql `"release"`,
};
/* —— Sessions list —— */
const SESSION_SORT_FIELDS = [
    "started_at",
    "ended_at",
    "session_id",
    "app",
    "platform",
    "user_id",
];
export function parseSessionListSortParam(v) {
    if (v === undefined || v === "")
        return { ok: true, sort: "started_at" };
    if (SESSION_SORT_FIELDS.includes(v)) {
        return { ok: true, sort: v };
    }
    return { ok: false };
}
export function sessionListOrderBy(sort, order) {
    return { [sort]: order };
}
/* —— Overview: error groups —— */
const OVERVIEW_ERR_SORT = [
    "occurrences",
    "last_seen",
    "first_seen",
    "message",
    "app",
];
export function parseOverviewErrorSortParam(v) {
    if (v === undefined || v === "")
        return { ok: true, sort: "occurrences" };
    if (OVERVIEW_ERR_SORT.includes(v)) {
        return { ok: true, sort: v };
    }
    return { ok: false };
}
export function overviewErrorOrderBy(sort, order) {
    return { [sort]: order };
}
export function parseOverviewTopEventsSortParam(v) {
    if (v === undefined || v === "")
        return { ok: true, sort: "count" };
    if (v === "count" || v === "name")
        return { ok: true, sort: v };
    return { ok: false };
}
