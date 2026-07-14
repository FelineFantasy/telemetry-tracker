/**
 * Deterministic snapshot size enforcement.
 * Operates on a clone; never mutates the original snapshot.
 */

import {
  BRIEF_MAX_CANDIDATES_PER_LIST,
  BRIEF_MAX_SNAPSHOT_BYTES,
} from "./brief-constants.js";
import type { BriefSnapshotRequest, ProjectSnapshot } from "./brief-contracts.js";
import { sortProjectsById } from "./brief-snapshot-sql.js";
import { sanitizeBriefText } from "./brief-snapshot-sanitize.js";

export type BriefSnapshotSizeMeta = {
  truncated: boolean;
  truncationSteps: string[];
  droppedProjectIds: string[];
  byteLength: number;
};

export type EnforceBriefSnapshotSizeResult =
  | {
      ok: true;
      snapshot: BriefSnapshotRequest;
      meta: BriefSnapshotSizeMeta;
    }
  | {
      ok: false;
      code: "snapshot_too_large";
      byteLength: number;
      maxBytes: number;
      projectCount: number;
      truncationSteps: string[];
      droppedProjectIds: string[];
    };

export function snapshotByteLength(snapshot: BriefSnapshotRequest): number {
  return Buffer.byteLength(JSON.stringify(snapshot), "utf8");
}

function cloneSnapshot(snapshot: BriefSnapshotRequest): BriefSnapshotRequest {
  return structuredClone(snapshot);
}

function projectActivityScore(project: ProjectSnapshot): number {
  return project.kpis.errors.count + project.kpis.events.count;
}

function shortenMessages(projects: ProjectSnapshot[], maxChars: number, step: string, steps: string[]) {
  for (const project of projects) {
    for (const list of [
      project.errorGroups.firstSeenInWindow,
      project.errorGroups.byOccurrenceCount,
      project.errorGroups.byAbsoluteDelta,
    ]) {
      for (const candidate of list) {
        candidate.message = sanitizeBriefText(candidate.message).slice(0, maxChars);
      }
    }
  }
  steps.push(step);
}

function halveCandidateLists(projects: ProjectSnapshot[], limit: number, step: string, steps: string[]) {
  for (const project of projects) {
    project.errorGroups.firstSeenInWindow = project.errorGroups.firstSeenInWindow.slice(0, limit);
    project.errorGroups.byOccurrenceCount = project.errorGroups.byOccurrenceCount.slice(0, limit);
    project.errorGroups.byAbsoluteDelta = project.errorGroups.byAbsoluteDelta.slice(0, limit);
  }
  steps.push(step);
}

function clearList(
  projects: ProjectSnapshot[],
  key: "byAbsoluteDelta" | "byOccurrenceCount" | "firstSeenInWindow",
  step: string,
  steps: string[]
) {
  for (const project of projects) {
    project.errorGroups[key] = [];
  }
  steps.push(step);
}

function dropOptionalBlocks(
  projects: ProjectSnapshot[],
  step: string,
  steps: string[],
  block: "deviceSlices" | "environments" | "releases" | "sessionsSummary"
) {
  for (const project of projects) {
    if (block === "deviceSlices") {
      for (const list of [
        project.errorGroups.firstSeenInWindow,
        project.errorGroups.byOccurrenceCount,
        project.errorGroups.byAbsoluteDelta,
      ]) {
        for (const candidate of list) {
          delete candidate.topBrowsers;
          delete candidate.topOs;
        }
      }
    }
    if (block === "environments") delete project.environments;
    if (block === "releases") delete project.releases;
    if (block === "sessionsSummary") delete project.sessionsSummary;
  }
  steps.push(step);
}

function dropLowestActivityProject(
  projects: ProjectSnapshot[],
  droppedProjectIds: string[],
  steps: string[]
): boolean {
  if (projects.length <= 1) return false;
  const sorted = sortProjectsById(projects);
  let lowest = sorted[0]!;
  for (const project of sorted) {
    const score = projectActivityScore(project);
    const lowestScore = projectActivityScore(lowest);
    if (
      score < lowestScore ||
      (score === lowestScore && project.projectId.localeCompare(lowest.projectId) > 0)
    ) {
      lowest = project;
    }
  }
  const index = projects.findIndex((p) => p.projectId === lowest.projectId);
  if (index < 0) return false;
  projects.splice(index, 1);
  droppedProjectIds.push(lowest.projectId);
  steps.push(`dropped.project:${lowest.projectId}`);
  return true;
}

/** Enforce the hard payload byte limit on a cloned snapshot. */
export function enforceBriefSnapshotSizeLimits(
  snapshot: BriefSnapshotRequest
): EnforceBriefSnapshotSizeResult {
  const working = cloneSnapshot(snapshot);
  working.projects = sortProjectsById(working.projects);

  const truncationSteps: string[] = [];
  const droppedProjectIds: string[] = [];

  const steps: Array<() => void> = [
    () => dropOptionalBlocks(working.projects, "drop.deviceSlices", truncationSteps, "deviceSlices"),
    () => dropOptionalBlocks(working.projects, "drop.environments", truncationSteps, "environments"),
    () => dropOptionalBlocks(working.projects, "drop.releases", truncationSteps, "releases"),
    () => dropOptionalBlocks(working.projects, "drop.sessionsSummary", truncationSteps, "sessionsSummary"),
    () => shortenMessages(working.projects, 500, "messages.max:500", truncationSteps),
    () => halveCandidateLists(working.projects, 5, "candidates.limit:5", truncationSteps),
    () => shortenMessages(working.projects, 200, "messages.max:200", truncationSteps),
    () => clearList(working.projects, "byAbsoluteDelta", "drop.byAbsoluteDelta", truncationSteps),
    () => clearList(working.projects, "byOccurrenceCount", "drop.byOccurrenceCount", truncationSteps),
    () => {
      for (const project of working.projects) {
        project.errorGroups.firstSeenInWindow = project.errorGroups.firstSeenInWindow.slice(0, 3);
      }
      truncationSteps.push("candidates.firstSeenInWindow.limit:3");
    },
    () => shortenMessages(working.projects, 100, "messages.max:100", truncationSteps),
    () => {
      while (
        snapshotByteLength(working) > BRIEF_MAX_SNAPSHOT_BYTES &&
        dropLowestActivityProject(working.projects, droppedProjectIds, truncationSteps)
      ) {
        // drop projects until under limit or only one remains
      }
    },
    () => clearList(working.projects, "firstSeenInWindow", "drop.firstSeenInWindow", truncationSteps),
  ];

  for (const step of steps) {
    if (snapshotByteLength(working) <= BRIEF_MAX_SNAPSHOT_BYTES) break;
    step();
  }

  const byteLength = snapshotByteLength(working);
  if (byteLength <= BRIEF_MAX_SNAPSHOT_BYTES && working.projects.length > 0) {
    return {
      ok: true,
      snapshot: working,
      meta: {
        truncated: truncationSteps.length > 0,
        truncationSteps,
        droppedProjectIds,
        byteLength,
      },
    };
  }

  return {
    ok: false,
    code: "snapshot_too_large",
    byteLength,
    maxBytes: BRIEF_MAX_SNAPSHOT_BYTES,
    projectCount: working.projects.length,
    truncationSteps,
    droppedProjectIds,
  };
}

/** @internal Exported for tests. */
export function maxCandidateListLimit(): number {
  return BRIEF_MAX_CANDIDATES_PER_LIST;
}
