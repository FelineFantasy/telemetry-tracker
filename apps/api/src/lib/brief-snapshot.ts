/**
 * Workspace brief snapshot builder.
 *
 * Pipeline:
 * assemble → sanitize → validate → enforce size → validate final → compute hashes
 *
 * firstSeenInWindow uses the error group's global first_seen timestamp. A group that
 * existed before `since` but has new occurrences in the window will not appear there.
 */

import type { PrismaClient } from "@prisma/client";
import { BRIEF_ASSEMBLY_CHUNK_SIZE, BRIEF_MAX_PROJECTS, BRIEF_SCHEMA_VERSION } from "./brief-constants.js";
import {
  briefSnapshotRequestSchema,
  type BriefSnapshotRequest,
  type ProjectSnapshot,
} from "./brief-contracts.js";
import { loadBriefAcknowledgements } from "./brief-ack.js";
import { resolveBriefProjectWindows } from "./brief-window.js";
import { fetchBriefBatchData, type BriefBatchData, type BriefCandidateBase } from "./brief-snapshot-batch.js";
import { computeContentHash, computeSnapshotHash } from "./brief-snapshot-hash.js";
import {
  enforceBriefSnapshotSizeLimits,
  type BriefSnapshotSizeMeta,
  snapshotByteLength,
} from "./brief-snapshot-size.js";
import { sanitizeBriefSnapshot } from "./brief-snapshot-sanitize.js";
import {
  projectWindowsFromBriefWindows,
  sortProjectsById,
} from "./brief-snapshot-sql.js";

export type BuildWorkspaceBriefSnapshotInput = {
  organizationId: string;
  requestId: string;
  requestUntil: Date;
  viewerTimezone?: string | null;
  userId: string;
  projects: Array<{
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
  }>;
  /** When true, windows ignore per-user acknowledgement state (organization-scoped async path). */
  skipUserAcknowledgements?: boolean;
};

export type BuildWorkspaceBriefSnapshotSuccess = {
  ok: true;
  snapshot: BriefSnapshotRequest;
  contentHash: string;
  snapshotHash: string;
  meta: BriefSnapshotSizeMeta;
};

export type BuildWorkspaceBriefSnapshotFailure =
  | {
      ok: false;
      code: "no_projects";
    }
  | {
      ok: false;
      code: "snapshot_too_large";
      byteLength: number;
      maxBytes: number;
      projectCount: number;
      truncationSteps: string[];
      droppedProjectIds: string[];
    }
  | {
      ok: false;
      code: "invalid_snapshot";
      error: string;
    };

export type BuildWorkspaceBriefSnapshotResult =
  | BuildWorkspaceBriefSnapshotSuccess
  | BuildWorkspaceBriefSnapshotFailure;

function validateSnapshot(snapshot: BriefSnapshotRequest): { ok: true } | { ok: false; error: string } {
  const parsed = briefSnapshotRequestSchema.safeParse(snapshot);
  if (!parsed.success) {
    return { ok: false, error: "Invalid brief snapshot request" };
  }
  return { ok: true };
}

function buildCandidate(
  base: BriefCandidateBase,
  batch: BriefBatchData
): ProjectSnapshot["errorGroups"]["firstSeenInWindow"][number] {
  const metrics = batch.candidateMetrics.get(base.id) ?? {
    occurrences: { count: 0, previous: 0 },
    affectedUsers: { count: 0, previous: 0 },
  };
  const browsers = batch.topBrowsers.get(base.projectId)?.get(base.id);
  const os = batch.topOs.get(base.projectId)?.get(base.id);

  return {
    id: base.id,
    message: base.message,
    app: base.app,
    ...(base.environment ? { environment: base.environment } : {}),
    ...(base.release ? { release: base.release } : {}),
    firstSeen: base.firstSeen.toISOString(),
    lastSeen: base.lastSeen.toISOString(),
    occurrences: metrics.occurrences,
    affectedUsers: metrics.affectedUsers,
    ...(browsers && browsers.length > 0 ? { topBrowsers: browsers } : {}),
    ...(os && os.length > 0 ? { topOs: os } : {}),
  };
}

function assembleProjectSnapshot(
  project: BuildWorkspaceBriefSnapshotInput["projects"][number],
  window: ReturnType<typeof resolveBriefProjectWindows>[number],
  batch: BriefBatchData
): ProjectSnapshot {
  const kpis = batch.kpis.get(project.id) ?? {
    errors: { count: 0, previous: 0 },
    events: { count: 0, previous: 0 },
    sessions: { count: 0, previous: 0 },
    activeUsers: { count: 0, previous: 0 },
    errorRatePct: { value: 0, previous: 0 },
  };

  const mapCandidates = (list: BriefCandidateBase[]) => list.map((row) => buildCandidate(row, batch));

  const releaseRows = batch.releases.get(project.id) ?? [];
  const environmentRows = batch.environments.get(project.id) ?? [];
  const sessionsSummary = batch.sessionsSummary.get(project.id);

  return {
    projectId: project.id,
    projectName: project.name,
    projectSlug: project.slug,
    window: {
      since: window.since.toISOString(),
      until: window.until.toISOString(),
      previousSince: window.previousSince.toISOString(),
      previousUntil: window.previousUntil.toISOString(),
      durationMs: window.durationMs,
    },
    kpis,
    errorGroups: {
      firstSeenInWindow: mapCandidates(batch.firstSeenInWindow.get(project.id) ?? []),
      byOccurrenceCount: mapCandidates(batch.byOccurrenceCount.get(project.id) ?? []),
      byAbsoluteDelta: mapCandidates(batch.byAbsoluteDelta.get(project.id) ?? []),
    },
    ...(releaseRows.length > 0
      ? {
          releases: {
            byErrorOccurrences: releaseRows.map((row) => ({
              release: row.release,
              errorOccurrences: row.errorOccurrences,
              eventRows: row.eventRows,
            })),
          },
        }
      : {}),
    ...(environmentRows.length > 0
      ? {
          environments: {
            byEventRows: environmentRows.map((row) => ({
              environment: row.environment,
              count: row.count,
            })),
          },
        }
      : {}),
    ...(sessionsSummary && Object.keys(sessionsSummary).length > 0
      ? { sessionsSummary }
      : {}),
  };
}

async function assembleProjects(
  input: BuildWorkspaceBriefSnapshotInput,
  batch: BriefBatchData,
  windows: ReturnType<typeof resolveBriefProjectWindows>
): Promise<ProjectSnapshot[]> {
  const sortedProjects = sortProjectsById(
    input.projects.map((project) => ({ ...project, projectId: project.id }))
  ).map((row) => input.projects.find((p) => p.id === row.projectId)!);

  const windowByProject = new Map(windows.map((w) => [w.projectId, w]));
  const assembled: ProjectSnapshot[] = [];

  for (let i = 0; i < sortedProjects.length; i += BRIEF_ASSEMBLY_CHUNK_SIZE) {
    const chunk = sortedProjects.slice(i, i + BRIEF_ASSEMBLY_CHUNK_SIZE);
    const chunkSnapshots = await Promise.all(
      chunk.map((project) => {
        const window = windowByProject.get(project.id);
        if (!window) {
          throw new Error(`Missing brief window for project ${project.id}`);
        }
        return assembleProjectSnapshot(project, window, batch);
      })
    );
    assembled.push(...chunkSnapshots);
  }

  return sortProjectsById(assembled);
}

export async function buildWorkspaceBriefSnapshot(
  prisma: PrismaClient,
  input: BuildWorkspaceBriefSnapshotInput
): Promise<BuildWorkspaceBriefSnapshotResult> {
  const sortedAll = [...input.projects].sort((a, b) => a.id.localeCompare(b.id));
  const sortedProjects = sortedAll.slice(0, BRIEF_MAX_PROJECTS);
  const projectCapDroppedIds = sortedAll.slice(BRIEF_MAX_PROJECTS).map((project) => project.id);

  if (sortedProjects.length === 0) {
    return { ok: false, code: "no_projects" };
  }

  const acknowledgements = input.skipUserAcknowledgements
    ? new Map<string, Date>()
    : await loadBriefAcknowledgements(
        prisma,
        input.userId,
        sortedProjects.map((p) => p.id)
      );

  const briefWindows = resolveBriefProjectWindows(
    sortedProjects.map((project) => ({
      projectId: project.id,
      projectCreatedAt: project.createdAt,
      acknowledgedThrough: acknowledgements.get(project.id) ?? null,
      requestUntil: input.requestUntil,
    })),
    input.requestUntil
  );

  const projectWindows = projectWindowsFromBriefWindows(briefWindows);
  const batch = await fetchBriefBatchData(prisma, projectWindows);

  const assembled: BriefSnapshotRequest = {
    schemaVersion: BRIEF_SCHEMA_VERSION,
    requestId: input.requestId,
    generatedAt: input.requestUntil.toISOString(),
    organizationId: input.organizationId,
    viewer: {
      ...(input.viewerTimezone ? { timezone: input.viewerTimezone } : {}),
    },
    projects: await assembleProjects(
      { ...input, projects: sortedProjects },
      batch,
      briefWindows
    ),
  };

  const sanitized = sanitizeBriefSnapshot(assembled);
  const firstValidation = validateSnapshot(sanitized);
  if (!firstValidation.ok) {
    return { ok: false, code: "invalid_snapshot", error: firstValidation.error };
  }

  const sizeResult = enforceBriefSnapshotSizeLimits(sanitized);
  if (!sizeResult.ok) {
    return {
      ok: false,
      code: "snapshot_too_large",
      byteLength: sizeResult.byteLength,
      maxBytes: sizeResult.maxBytes,
      projectCount: sizeResult.projectCount,
      truncationSteps: sizeResult.truncationSteps,
      droppedProjectIds: [...projectCapDroppedIds, ...sizeResult.droppedProjectIds],
    };
  }

  const finalValidation = validateSnapshot(sizeResult.snapshot);
  if (!finalValidation.ok) {
    return { ok: false, code: "invalid_snapshot", error: finalValidation.error };
  }

  return {
    ok: true,
    snapshot: sizeResult.snapshot,
    contentHash: computeContentHash(sizeResult.snapshot),
    snapshotHash: computeSnapshotHash(sizeResult.snapshot),
    meta: {
      ...sizeResult.meta,
      truncated: sizeResult.meta.truncated || projectCapDroppedIds.length > 0,
      droppedProjectIds: [...projectCapDroppedIds, ...sizeResult.meta.droppedProjectIds],
    },
  };
}

/** @internal Test helper for byte-size assertions. */
export function measureSnapshotBytes(snapshot: BriefSnapshotRequest): number {
  return snapshotByteLength(snapshot);
}
