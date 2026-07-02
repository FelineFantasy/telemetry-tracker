import { originalPositionFor, TraceMap } from "@jridgewell/trace-mapping";
import type { PrismaClient, SourceMapArtifact } from "@prisma/client";
import {
  getSourceMapArtifactContentById,
  listSourceMapArtifactRefsForRelease,
  MAX_SOURCE_MAP_CONTENT_LOADS_PER_DETAIL,
  normalizeBundleUrl,
  normalizeMapAppLabel,
  normalizeMapReleaseLabel,
  type SourceMapArtifactRef,
} from "./source-map-artifact.js";

export type ParsedStackFrame = {
  raw: string;
  /** File or URL from the frame, when parseable. */
  file?: string;
  line?: number;
  column?: number;
  functionName?: string;
};

const V8_WITH_FN =
  /^(\s*at\s+)(.+?)\s+\((.+?):(\d+):(\d+)\)\s*$/;
const V8_NO_FN = /^(\s*at\s+)(.+?):(\d+):(\d+)\s*$/;
const FIREFOX = /^(\s*)(.+?)@(.+?):(\d+):(\d+)\s*$/;

export function parseStackFrame(line: string): ParsedStackFrame {
  const v8Fn = line.match(V8_WITH_FN);
  if (v8Fn) {
    return {
      raw: line,
      functionName: v8Fn[2],
      file: v8Fn[3],
      line: Number(v8Fn[4]),
      column: Number(v8Fn[5]),
    };
  }
  const v8NoFn = line.match(V8_NO_FN);
  if (v8NoFn) {
    return {
      raw: line,
      file: v8NoFn[2],
      line: Number(v8NoFn[3]),
      column: Number(v8NoFn[4]),
    };
  }
  const firefox = line.match(FIREFOX);
  if (firefox) {
    return {
      raw: line,
      functionName: firefox[2],
      file: firefox[3],
      line: Number(firefox[4]),
      column: Number(firefox[5]),
    };
  }
  return { raw: line };
}

export function frameMatchesBundle(frameFile: string, bundleUrl: string): boolean {
  const frame = normalizeBundleUrl(frameFile);
  const bundle = normalizeBundleUrl(bundleUrl);
  if (frame === bundle) return true;

  if (frame.includes("://") && bundle.includes("://")) {
    try {
      const frameUrl = new URL(frame);
      const bundleUrlObj = new URL(bundle);
      return (
        frameUrl.origin === bundleUrlObj.origin &&
        frameUrl.pathname === bundleUrlObj.pathname
      );
    } catch {
      return false;
    }
  }

  if (!frame.includes("://") && bundle.includes("://")) {
    const frameBase = frame.split(/[/?#]/).pop() ?? frame;
    if (frameBase.length === 0) return false;
    try {
      const bundlePathBase =
        new URL(bundle).pathname.split("/").filter(Boolean).pop() ?? "";
      return frameBase === bundlePathBase;
    } catch {
      return false;
    }
  }

  if (!frame.includes("://") && !bundle.includes("://")) {
    const frameBase = frame.split(/[/?#]/).pop() ?? frame;
    const bundleBase = bundle.split(/[/?#]/).pop() ?? bundle;
    return frameBase.length > 0 && frameBase === bundleBase;
  }

  return false;
}

export function findMatchingArtifact(
  frameFile: string,
  artifacts: Pick<SourceMapArtifact, "bundle_url" | "content">[]
): Pick<SourceMapArtifact, "bundle_url" | "content"> | null {
  for (const artifact of artifacts) {
    if (frameMatchesBundle(frameFile, artifact.bundle_url)) return artifact;
  }
  return null;
}

export function findMatchingArtifactRef(
  frameFile: string,
  refs: SourceMapArtifactRef[]
): SourceMapArtifactRef | null {
  for (const ref of refs) {
    if (frameMatchesBundle(frameFile, ref.bundle_url)) return ref;
  }
  return null;
}

function formatSymbolicatedLine(
  frame: ParsedStackFrame,
  source: string | null | undefined,
  line: number | null | undefined,
  column: number | null | undefined,
  name: string | null | undefined
): string {
  const loc =
    source != null && line != null
      ? `${source}:${line}${column != null ? `:${column}` : ""}`
      : null;
  if (!loc) return frame.raw;

  const fn = name ?? frame.functionName;
  const v8Fn = frame.raw.match(V8_WITH_FN);
  if (v8Fn) {
    const fnLabel = fn ?? "<anonymous>";
    return `${v8Fn[1]}${fnLabel} (${loc})`;
  }
  const v8NoFn = frame.raw.match(V8_NO_FN);
  if (v8NoFn) {
    return `${v8NoFn[1]}${loc}`;
  }
  const firefox = frame.raw.match(FIREFOX);
  if (firefox) {
    const fnLabel = fn ?? firefox[2];
    return `${firefox[1]}${fnLabel}@${loc}`;
  }
  return frame.raw;
}

/** Symbolicate a stack string using uploaded source maps. Returns input when nothing resolves. */
export function symbolicateStackTrace(
  stack: string,
  artifacts: Pick<SourceMapArtifact, "bundle_url" | "content">[]
): string {
  if (!stack.trim() || artifacts.length === 0) return stack;

  const lines = stack.split(/\r?\n/);
  let changed = false;
  const out = lines.map((line) => {
    const frame = parseStackFrame(line);
    if (frame.file == null || frame.line == null || frame.column == null) {
      return line;
    }
    const artifact = findMatchingArtifact(frame.file, artifacts);
    if (!artifact) return line;

    let map: TraceMap;
    try {
      map = new TraceMap(JSON.parse(artifact.content));
    } catch {
      return line;
    }

    const orig = originalPositionFor(map, {
      line: frame.line,
      column: Math.max(0, frame.column),
    });
    if (orig.source == null && orig.line == null) return line;

    const next = formatSymbolicatedLine(frame, orig.source, orig.line, orig.column, orig.name);
    if (next !== line) changed = true;
    return next;
  });

  return changed ? out.join("\n") : stack;
}

/** First resolvable frame line in a stack, symbolicated when a map exists. */
export function firstSymbolicatedFrameLine(
  stack: string,
  artifacts: Pick<SourceMapArtifact, "bundle_url" | "content">[]
): string | null {
  for (const line of stack.split(/\r?\n/)) {
    const frame = parseStackFrame(line);
    if (frame.file == null || frame.line == null || frame.column == null) continue;
    const symbolicated = symbolicateStackTrace(line, artifacts);
    if (symbolicated !== line) return symbolicated;
  }
  return null;
}

function createSymbolicateContext(
  prisma: PrismaClient,
  projectId: string,
  app: string
) {
  const refsByRelease = new Map<string, Promise<SourceMapArtifactRef[]>>();
  const contentById = new Map<string, Pick<SourceMapArtifact, "bundle_url" | "content">>();
  let contentLoads = 0;

  async function refsForRelease(release: string): Promise<SourceMapArtifactRef[]> {
    let load = refsByRelease.get(release);
    if (!load) {
      load = listSourceMapArtifactRefsForRelease(prisma, projectId, app, release);
      refsByRelease.set(release, load);
    }
    return load;
  }

  async function artifactsForStack(
    stack: string,
    release: string
  ): Promise<Pick<SourceMapArtifact, "bundle_url" | "content">[]> {
    const refs = await refsForRelease(release);
    if (refs.length === 0) return [];

    const artifacts: Pick<SourceMapArtifact, "bundle_url" | "content">[] = [];
    const seenIds = new Set<string>();

    for (const line of stack.split(/\r?\n/)) {
      const frame = parseStackFrame(line);
      if (frame.file == null) continue;

      const ref = findMatchingArtifactRef(frame.file, refs);
      if (!ref || seenIds.has(ref.id)) continue;
      seenIds.add(ref.id);

      let artifact = contentById.get(ref.id);
      if (!artifact) {
        if (contentLoads >= MAX_SOURCE_MAP_CONTENT_LOADS_PER_DETAIL) break;
        const row = await getSourceMapArtifactContentById(prisma, ref.id);
        contentLoads += 1;
        if (!row) continue;
        artifact = row;
        contentById.set(ref.id, row);
      }
      artifacts.push(artifact);
    }

    return artifacts;
  }

  return { artifactsForStack };
}

export async function symbolicateOccurrenceStack(
  prisma: PrismaClient,
  projectId: string,
  app: string,
  release: string | null | undefined,
  stack: string | null | undefined
): Promise<string | null> {
  const releaseLabel = normalizeMapReleaseLabel(release);
  const stackText = stack?.trim();
  if (!releaseLabel || !stackText) return null;

  const { artifactsForStack } = createSymbolicateContext(
    prisma,
    projectId,
    normalizeMapAppLabel(app)
  );
  const artifacts = await artifactsForStack(stackText, releaseLabel);
  if (artifacts.length === 0) return null;

  const symbolicated = symbolicateStackTrace(stackText, artifacts);
  return symbolicated === stackText ? null : symbolicated;
}

type ErrorGroupWithOccurrences = {
  app: string;
  release?: string | null;
  top_stack?: string | null;
  occurrences_list: Array<{
    stack?: string | null;
    release?: string | null;
    symbolicated_stack?: string | null;
    [key: string]: unknown;
  }>;
  symbolicated_top_stack?: string | null;
  [key: string]: unknown;
};

export async function enrichErrorGroupWithSymbolicatedStacks<
  T extends ErrorGroupWithOccurrences,
>(prisma: PrismaClient, projectId: string, group: T): Promise<T> {
  const app = normalizeMapAppLabel(group.app);
  const { artifactsForStack } = createSymbolicateContext(prisma, projectId, app);

  const newest = group.occurrences_list[0];
  let symbolicatedTop: string | null = null;
  if (newest?.stack?.trim()) {
    const newestRelease = normalizeMapReleaseLabel(newest.release ?? group.release);
    if (newestRelease) {
      const artifacts = await artifactsForStack(newest.stack, newestRelease);
      symbolicatedTop = firstSymbolicatedFrameLine(newest.stack, artifacts);
    }
  }

  const occurrences_list = await Promise.all(
    group.occurrences_list.map(async (occ) => {
      const release = normalizeMapReleaseLabel(occ.release ?? group.release);
      if (!occ.stack?.trim() || !release) return occ;
      const artifacts = await artifactsForStack(occ.stack, release);
      const symbolicated = symbolicateStackTrace(occ.stack, artifacts);
      if (symbolicated === occ.stack) return occ;
      return { ...occ, symbolicated_stack: symbolicated };
    })
  );

  return {
    ...group,
    ...(symbolicatedTop ? { symbolicated_top_stack: symbolicatedTop } : {}),
    occurrences_list,
  };
}
