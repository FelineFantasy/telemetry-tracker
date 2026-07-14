/**
 * Integrity checks for private workspace brief responses.
 * Schema validation alone is insufficient — this binds the response to the snapshot.
 */

import type { BriefAction, BriefSnapshotRequest, WorkspaceBriefResponse } from "./brief-contracts.js";

export type BriefResponseIntegrityFailure =
  | "request_id_mismatch"
  | "duplicate_project"
  | "unknown_project"
  | "missing_project"
  | "generated_through_mismatch"
  | "action_project_mismatch"
  | "action_error_group_unknown"
  | "evidence_error_group_unknown";

export type BriefResponseIntegrityResult =
  | { ok: true }
  | { ok: false; code: BriefResponseIntegrityFailure; message: string };

function collectCandidateIds(snapshot: BriefSnapshotRequest, projectId: string): Set<string> {
  const project = snapshot.projects.find((p) => p.projectId === projectId);
  if (!project) return new Set();
  const ids = new Set<string>();
  for (const list of [
    project.errorGroups.firstSeenInWindow,
    project.errorGroups.byOccurrenceCount,
    project.errorGroups.byAbsoluteDelta,
  ]) {
    for (const row of list) ids.add(row.id);
  }
  return ids;
}

function validateAction(
  action: BriefAction,
  snapshotProjectIds: Set<string>,
  snapshot: BriefSnapshotRequest
): BriefResponseIntegrityResult {
  if (!snapshotProjectIds.has(action.projectId)) {
    return {
      ok: false,
      code: "action_project_mismatch",
      message: `Action references unknown project ${action.projectId}`,
    };
  }
  if (action.type === "open_error_group") {
    const allowed = collectCandidateIds(snapshot, action.projectId);
    if (!allowed.has(action.errorGroupId)) {
      return {
        ok: false,
        code: "action_error_group_unknown",
        message: `Action references unknown error group ${action.errorGroupId}`,
      };
    }
  }
  return { ok: true };
}

function validateEvidenceRefs(
  projectId: string,
  bullets: WorkspaceBriefResponse["projects"][number]["bullets"],
  snapshot: BriefSnapshotRequest
): BriefResponseIntegrityResult {
  if (!bullets?.length) return { ok: true };

  const allowed = collectCandidateIds(snapshot, projectId);
  for (const bullet of bullets) {
    for (const ref of bullet.evidenceRefs ?? []) {
      if (ref.kind === "error_group" && !allowed.has(ref.id)) {
        return {
          ok: false,
          code: "evidence_error_group_unknown",
          message: `Evidence references unknown error group ${ref.id}`,
        };
      }
    }
  }
  return { ok: true };
}

/** Verify a parsed private response against the transmitted snapshot. */
export function validateWorkspaceBriefResponseIntegrity(
  snapshot: BriefSnapshotRequest,
  response: WorkspaceBriefResponse
): BriefResponseIntegrityResult {
  if (response.requestId !== snapshot.requestId) {
    return {
      ok: false,
      code: "request_id_mismatch",
      message: "response.requestId does not match snapshot.requestId",
    };
  }

  const snapshotById = new Map(snapshot.projects.map((p) => [p.projectId, p]));
  const snapshotProjectIds = new Set(snapshotById.keys());
  const seenResponseIds = new Set<string>();

  for (const projectBrief of response.projects) {
    if (seenResponseIds.has(projectBrief.projectId)) {
      return {
        ok: false,
        code: "duplicate_project",
        message: `Duplicate project brief for ${projectBrief.projectId}`,
      };
    }
    seenResponseIds.add(projectBrief.projectId);

    if (!snapshotProjectIds.has(projectBrief.projectId)) {
      return {
        ok: false,
        code: "unknown_project",
        message: `Response includes unknown project ${projectBrief.projectId}`,
      };
    }

    const expectedUntil = snapshotById.get(projectBrief.projectId)!.window.until;
    if (projectBrief.generatedThrough !== expectedUntil) {
      return {
        ok: false,
        code: "generated_through_mismatch",
        message: `generatedThrough mismatch for project ${projectBrief.projectId}`,
      };
    }

    const evidenceResult = validateEvidenceRefs(
      projectBrief.projectId,
      projectBrief.bullets,
      snapshot
    );
    if (!evidenceResult.ok) return evidenceResult;

    if (projectBrief.suggestedNextStep) {
      const actionResult = validateAction(
        projectBrief.suggestedNextStep,
        snapshotProjectIds,
        snapshot
      );
      if (!actionResult.ok) return actionResult;
    }
  }

  for (const projectId of snapshotProjectIds) {
    if (!seenResponseIds.has(projectId)) {
      return {
        ok: false,
        code: "missing_project",
        message: `Response missing project ${projectId}`,
      };
    }
  }

  return { ok: true };
}
