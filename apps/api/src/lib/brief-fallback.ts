import { BRIEF_FALLBACK_SCHEMA_VERSION } from "./brief-constants.js";
import type { BriefSnapshotRequest } from "./brief-contracts.js";

export type BriefFallbackFact =
  | { kind: "error_count"; current: number; previous: number }
  | { kind: "event_count"; current: number; previous: number }
  | { kind: "session_count"; current: number; previous: number }
  | { kind: "active_user_count"; current: number; previous: number }
  | { kind: "first_seen_error_groups"; count: number }
  | { kind: "top_error_group_occurrences"; count: number; message: string };

export type WorkspaceBriefFallbackResponse = {
  schemaVersion: typeof BRIEF_FALLBACK_SCHEMA_VERSION;
  requestId: string;
  generatedAt: string;
  projects: Array<{
    projectId: string;
    generatedThrough: string;
    facts: BriefFallbackFact[];
  }>;
};

/** Factual-only fallback from the served snapshot projects. No significance or ranking. */
export function buildWorkspaceBriefFallback(
  snapshot: BriefSnapshotRequest,
  requestId: string,
  generatedAt: Date
): WorkspaceBriefFallbackResponse {
  return {
    schemaVersion: BRIEF_FALLBACK_SCHEMA_VERSION,
    requestId,
    generatedAt: generatedAt.toISOString(),
    projects: snapshot.projects.map((project) => {
      const facts: BriefFallbackFact[] = [
        {
          kind: "error_count",
          current: project.kpis.errors.count,
          previous: project.kpis.errors.previous,
        },
        {
          kind: "event_count",
          current: project.kpis.events.count,
          previous: project.kpis.events.previous,
        },
        {
          kind: "session_count",
          current: project.kpis.sessions.count,
          previous: project.kpis.sessions.previous,
        },
        {
          kind: "active_user_count",
          current: project.kpis.activeUsers.count,
          previous: project.kpis.activeUsers.previous,
        },
        {
          kind: "first_seen_error_groups",
          count: project.errorGroups.firstSeenInWindow.length,
        },
      ];

      const top = project.errorGroups.byOccurrenceCount[0];
      if (top) {
        facts.push({
          kind: "top_error_group_occurrences",
          count: top.occurrences.count,
          message: top.message,
        });
      }

      return {
        projectId: project.projectId,
        generatedThrough: project.window.until,
        facts,
      };
    }),
  };
}
