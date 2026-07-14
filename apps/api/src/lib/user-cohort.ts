/**
 * New vs returning user cohort rules for dashboard analytics.
 *
 * - **New**: first session for the identity in the project scope is on or after window start.
 * - **Returning**: identity was first seen before window start and is active again in the window.
 *
 * Identity key matches sessions KPIs: trimmed user_id, else trimmed anonymous_id.
 */

export type UserCohort = "new" | "returning";

export function cohortIdentityKey(
  userId: string | null | undefined,
  anonymousId: string | null | undefined,
  anonymousToUserId: ReadonlyMap<string, string> = new Map()
): string | null {
  const uid = userId?.trim();
  if (uid) return uid;
  const aid = anonymousId?.trim();
  if (!aid) return null;
  return anonymousToUserId.get(aid) ?? aid;
}

/** Classify one identity active in the window by project first-seen vs window start. */
export function classifyUserCohort(
  firstSeenAt: Date,
  windowSince: Date
): UserCohort {
  return firstSeenAt >= windowSince ? "new" : "returning";
}

export type UserCohortCounts = {
  newUsers: number;
  returningUsers: number;
};

export function countUserCohorts(
  entries: Array<{ identity: string; firstSeenAt: Date }>,
  windowSince: Date
): UserCohortCounts {
  let newUsers = 0;
  let returningUsers = 0;
  for (const entry of entries) {
    if (classifyUserCohort(entry.firstSeenAt, windowSince) === "new") {
      newUsers += 1;
    } else {
      returningUsers += 1;
    }
  }
  return { newUsers, returningUsers };
}

export function cohortSharePct(part: number, total: number): number {
  if (total <= 0) return 0;
  return (part / total) * 100;
}
