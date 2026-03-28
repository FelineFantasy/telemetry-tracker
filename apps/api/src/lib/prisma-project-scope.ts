import type { Prisma } from "@prisma/client";

/**
 * Prisma schema uses snake_case field names (`project_id`). The generated client matches,
 * but some IDE Prisma extension setups incorrectly flag these filters. Centralize casts here
 * so `api.ts` stays clean and `npx tsc` / runtime stay unchanged.
 */
export function whereEventProject(projectId: string): Prisma.EventWhereInput {
  return { project_id: projectId } as Prisma.EventWhereInput;
}

export function whereSessionProject(projectId: string): Prisma.SessionWhereInput {
  return { project_id: projectId } as Prisma.SessionWhereInput;
}

export function whereErrorGroupProject(projectId: string): Prisma.ErrorGroupWhereInput {
  return { project_id: projectId } as Prisma.ErrorGroupWhereInput;
}

export function whereErrorGroupById(
  id: string,
  projectId: string
): Prisma.ErrorGroupWhereInput {
  return { id, project_id: projectId } as Prisma.ErrorGroupWhereInput;
}

export function whereEventById(id: string, projectId: string): Prisma.EventWhereInput {
  return { id, project_id: projectId } as Prisma.EventWhereInput;
}

export function whereSessionById(id: string, projectId: string): Prisma.SessionWhereInput {
  return { id, project_id: projectId } as Prisma.SessionWhereInput;
}

export function whereErrorOccurrenceSince(
  projectId: string,
  since: Date,
  app?: string
): Prisma.ErrorOccurrenceWhereInput {
  const error_group = app
    ? { project_id: projectId, app }
    : { project_id: projectId };
  return {
    created_at: { gte: since },
    error_group,
  } as Prisma.ErrorOccurrenceWhereInput;
}

export function whereErrorOccurrencePreviousWindow(
  projectId: string,
  previousSince: Date,
  since: Date,
  app?: string
): Prisma.ErrorOccurrenceWhereInput {
  const error_group = app
    ? { project_id: projectId, app }
    : { project_id: projectId };
  return {
    created_at: { gte: previousSince, lt: since },
    error_group,
  } as Prisma.ErrorOccurrenceWhereInput;
}
