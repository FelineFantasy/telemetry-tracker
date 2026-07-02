import { originalPositionFor, TraceMap } from "@jridgewell/trace-mapping";
import type { PrismaClient, SourceMapArtifact } from "@prisma/client";
import {
  listSourceMapArtifactsForRelease,
  normalizeBundleUrl,
  normalizeMapAppLabel,
  normalizeMapReleaseLabel,
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

function createArtifactsLoader(
  prisma: PrismaClient,
  projectId: string,
  app: string
): (release: string | null | undefined) => Promise<Pick<SourceMapArtifact, "bundle_url" | "content">[]> {
  const pending = new Map<string, Promise<Pick<SourceMapArtifact, "bundle_url" | "content">[]>>();
  return (release: string | null | undefined) => {
    const key = normalizeMapReleaseLabel(release) ?? "";
    if (!key) return Promise.resolve([]);
    let load = pending.get(key);
    if (!load) {
      load = listSourceMapArtifactsForRelease(prisma, projectId, app, key);
      pending.set(key, load);
    }
    return load;
  };
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

  const artifacts = await listSourceMapArtifactsForRelease(
    prisma,
    projectId,
    normalizeMapAppLabel(app),
    releaseLabel
  );
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
  const artifactsForRelease = createArtifactsLoader(prisma, projectId, app);

  const newest = group.occurrences_list[0];
  let symbolicatedTop: string | null = null;
  if (newest?.stack?.trim()) {
    const newestRelease = normalizeMapReleaseLabel(newest.release ?? group.release);
    if (newestRelease) {
      const artifacts = await artifactsForRelease(newestRelease);
      symbolicatedTop = firstSymbolicatedFrameLine(newest.stack, artifacts);
    }
  }

  const occurrences_list = await Promise.all(
    group.occurrences_list.map(async (occ) => {
      const release = normalizeMapReleaseLabel(occ.release ?? group.release);
      if (!occ.stack?.trim() || !release) return occ;
      const artifacts = await artifactsForRelease(release);
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
