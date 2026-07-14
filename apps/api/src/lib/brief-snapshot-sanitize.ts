/**
 * Central sanitization for brief snapshot text fields.
 * Raw user/session/anonymous IDs are excluded at query level, not here.
 */

import { BRIEF_MESSAGE_MAX_CHARS } from "./brief-constants.js";
import type { BriefSnapshotRequest, ProjectSnapshot } from "./brief-contracts.js";

type ErrorGroupCandidate = ProjectSnapshot["errorGroups"]["firstSeenInWindow"][number];

const EMAIL_RE =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const JWT_RE = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]{4,}\b/gi;
const API_KEY_RE =
  /\b(?:tt_live_[A-Za-z0-9_]+|sk-[A-Za-z0-9]{16,}|pk-[A-Za-z0-9]{16,})\b/g;
const SENSITIVE_PARAM_RE =
  /([?&](?:password|token|secret|api[_-]?key|access[_-]?token|auth|session|cookie)=)[^&\s]+/gi;
const SENSITIVE_ASSIGNMENT_RE =
  /\b(?:password|token|secret|api[_-]?key|access[_-]?token|auth|session|cookie)\s*=\s*[^\s&]+/gi;
const COOKIE_HEADER_RE =
  /\b(?:cookie|set-cookie|authorization)\s*:\s*[^\n]+/gi;
const SENSITIVE_UUID_CONTEXT_RE =
  /\b(?:user[_-]?id|anonymous[_-]?id|session[_-]?id|customer[_-]?id|account[_-]?id)\s*[=:]\s*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

function replaceSensitiveUuidContexts(text: string): string {
  const uuidMap = new Map<string, string>();
  let counter = 0;

  return text.replace(SENSITIVE_UUID_CONTEXT_RE, (match) => {
    if (!uuidMap.has(match)) {
      counter += 1;
      uuidMap.set(match, `[id:${counter}]`);
    }
    return uuidMap.get(match)!;
  });
}

function stripUrlQueryStrings(text: string): string {
  return text.replace(/https?:\/\/[^\s?]+(\?[^\s]+)/gi, (match, queryPart: string) => {
    if (/[?&](?:password|token|secret|key|auth)=/i.test(queryPart)) {
      return match.slice(0, match.length - queryPart.length);
    }
    return match.replace(/\?[^#\s]+/, "");
  });
}

/** Sanitize one error message before inclusion in the snapshot. */
export function sanitizeBriefText(text: string): string {
  let out = text;
  out = out.replace(EMAIL_RE, "[email]");
  out = out.replace(JWT_RE, "[token]");
  out = out.replace(BEARER_RE, "[token]");
  out = out.replace(API_KEY_RE, "[apikey]");
  out = out.replace(SENSITIVE_PARAM_RE, "$1[redacted]");
  out = out.replace(
    SENSITIVE_ASSIGNMENT_RE,
    (match) => `${match.split("=")[0]!.trim()}=[redacted]`
  );
  out = out.replace(COOKIE_HEADER_RE, "[redacted]");
  out = stripUrlQueryStrings(out);
  out = replaceSensitiveUuidContexts(out);
  out = out.replace(/\s+/g, " ").trim();
  if (out.length > BRIEF_MESSAGE_MAX_CHARS) {
    out = out.slice(0, BRIEF_MESSAGE_MAX_CHARS);
  }
  return out;
}

export function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function omitEmptyOptionalArray<T>(items: T[] | undefined): T[] | undefined {
  if (!items || items.length === 0) return undefined;
  return items;
}

function sanitizeCandidate(candidate: ErrorGroupCandidate): ErrorGroupCandidate {
  const topBrowsers = omitEmptyOptionalArray(
    candidate.topBrowsers
      ?.map((row) => ({
        browser: row.browser.trim().slice(0, 64),
        count: row.count,
      }))
      .filter((row) => row.browser.length > 0)
  );
  const topOs = omitEmptyOptionalArray(
    candidate.topOs
      ?.map((row) => ({
        os: row.os.trim().slice(0, 64),
        count: row.count,
      }))
      .filter((row) => row.os.length > 0)
  );

  const environment =
    typeof candidate.environment === "string" && candidate.environment.trim() !== ""
      ? candidate.environment.trim().slice(0, 64)
      : undefined;
  const release =
    typeof candidate.release === "string" && candidate.release.trim() !== ""
      ? candidate.release.trim().slice(0, 128)
      : undefined;

  return {
    id: candidate.id,
    app: candidate.app,
    firstSeen: candidate.firstSeen,
    lastSeen: candidate.lastSeen,
    occurrences: candidate.occurrences,
    affectedUsers: candidate.affectedUsers,
    message: sanitizeBriefText(candidate.message),
    ...(environment ? { environment } : {}),
    ...(release ? { release } : {}),
    ...(topBrowsers ? { topBrowsers } : {}),
    ...(topOs ? { topOs } : {}),
  };
}

/** Returns a new sanitized snapshot; does not mutate the input. */
export function sanitizeBriefSnapshot(snapshot: BriefSnapshotRequest): BriefSnapshotRequest {
  return {
    ...snapshot,
    projects: snapshot.projects.map((project) => {
      const sanitizeList = (list: typeof project.errorGroups.firstSeenInWindow) =>
        list.map((candidate) => sanitizeCandidate(candidate));

      const releases =
        project.releases && project.releases.byErrorOccurrences.length > 0
          ? {
              byErrorOccurrences: project.releases.byErrorOccurrences.map((row) => ({
                release: row.release.trim().slice(0, 128),
                errorOccurrences: row.errorOccurrences,
                eventRows: row.eventRows,
              })),
            }
          : undefined;

      const environments =
        project.environments && project.environments.byEventRows.length > 0
          ? {
              byEventRows: project.environments.byEventRows.map((row) => ({
                environment: row.environment.trim().slice(0, 64),
                count: row.count,
              })),
            }
          : undefined;

      const sessionsSummary = project.sessionsSummary
        ? {
            ...(project.sessionsSummary.avgDurationSec
              ? {
                  avgDurationSec: {
                    value: roundMetric(project.sessionsSummary.avgDurationSec.value),
                    previous: roundMetric(project.sessionsSummary.avgDurationSec.previous),
                  },
                }
              : {}),
            ...(project.sessionsSummary.bounceRatePct
              ? {
                  bounceRatePct: {
                    value: roundMetric(project.sessionsSummary.bounceRatePct.value),
                    previous: roundMetric(project.sessionsSummary.bounceRatePct.previous),
                  },
                }
              : {}),
            ...(project.sessionsSummary.crashFreeRatePct
              ? {
                  crashFreeRatePct: {
                    value: roundMetric(project.sessionsSummary.crashFreeRatePct.value),
                    previous: roundMetric(project.sessionsSummary.crashFreeRatePct.previous),
                  },
                }
              : {}),
            ...(project.sessionsSummary.activeUsers
              ? {
                  activeUsers: {
                    value: project.sessionsSummary.activeUsers.value,
                    previous: project.sessionsSummary.activeUsers.previous,
                  },
                }
              : {}),
          }
        : undefined;

      const hasSessionsSummary =
        sessionsSummary && Object.keys(sessionsSummary).length > 0 ? sessionsSummary : undefined;

      return {
        ...project,
        kpis: {
          ...project.kpis,
          errorRatePct: {
            value: roundMetric(project.kpis.errorRatePct.value),
            previous: roundMetric(project.kpis.errorRatePct.previous),
          },
        },
        errorGroups: {
          firstSeenInWindow: sanitizeList(project.errorGroups.firstSeenInWindow),
          byOccurrenceCount: sanitizeList(project.errorGroups.byOccurrenceCount),
          byAbsoluteDelta: sanitizeList(project.errorGroups.byAbsoluteDelta),
        },
        ...(releases ? { releases } : {}),
        ...(environments ? { environments } : {}),
        ...(hasSessionsSummary ? { sessionsSummary: hasSessionsSummary } : {}),
      };
    }),
  };
}
