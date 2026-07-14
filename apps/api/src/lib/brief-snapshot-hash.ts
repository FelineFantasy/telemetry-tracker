/**
 * Stable hashing for brief snapshots.
 * Uses explicit projections — never mutates the transmitted snapshot.
 */

import { createHash } from "node:crypto";
import { BRIEF_SCHEMA_VERSION } from "./brief-constants.js";
import type { BriefSnapshotRequest, ProjectSnapshot } from "./brief-contracts.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Deterministic JSON with sorted object keys; array order preserved. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`);
  return `{${entries.join(",")}}`;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

type ContentHashProject = {
  projectId: string;
  window: ProjectSnapshot["window"];
  kpis: ProjectSnapshot["kpis"];
  errorGroups: ProjectSnapshot["errorGroups"];
  releases?: ProjectSnapshot["releases"];
  sessionsSummary?: ProjectSnapshot["sessionsSummary"];
  environments?: ProjectSnapshot["environments"];
};

function projectContentProjection(project: ProjectSnapshot): ContentHashProject {
  return {
    projectId: project.projectId,
    window: project.window,
    kpis: project.kpis,
    errorGroups: project.errorGroups,
    ...(project.releases ? { releases: project.releases } : {}),
    ...(project.sessionsSummary ? { sessionsSummary: project.sessionsSummary } : {}),
    ...(project.environments ? { environments: project.environments } : {}),
  };
}

function projectSnapshotProjection(project: ProjectSnapshot) {
  return {
    projectName: project.projectName,
    projectSlug: project.projectSlug,
    ...projectContentProjection(project),
  };
}

/** Facts-only hash for AI idempotency and cache reuse. */
export function computeContentHash(snapshot: BriefSnapshotRequest): string {
  const projection = {
    schemaVersion: BRIEF_SCHEMA_VERSION,
    organizationId: snapshot.organizationId,
    projects: snapshot.projects.map(projectContentProjection),
  };
  return sha256Hex(stableStringify(projection));
}

/** Acknowledgement integrity hash for the exact served brief payload. */
export function computeSnapshotHash(snapshot: BriefSnapshotRequest): string {
  const projection = {
    schemaVersion: BRIEF_SCHEMA_VERSION,
    organizationId: snapshot.organizationId,
    projects: snapshot.projects.map(projectSnapshotProjection),
  };
  return sha256Hex(stableStringify(projection));
}

/** @internal Test helper for key-order invariance checks. */
export function reorderObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(reorderObjectKeys);
  }
  if (!isPlainObject(value)) return value;
  const keys = Object.keys(value).sort().reverse();
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    out[key] = reorderObjectKeys(value[key]);
  }
  return out;
}
