import type { PrismaClient } from "@prisma/client";
import {
  errorSpikeDedupeKey,
  parseProjectAlertSettings,
  type ProjectAlertSettings,
} from "./project-alert-settings.js";
import { fireProjectAlert } from "./alert-dispatch.js";

export async function loadProjectAlertSettings(
  prisma: PrismaClient,
  projectId: string
): Promise<ProjectAlertSettings> {
  const row = await prisma.project.findFirst({
    where: { id: projectId, deleted_at: null },
    select: { alert_settings: true },
  });
  if (!row) {
    return parseProjectAlertSettings(null);
  }
  return parseProjectAlertSettings(row.alert_settings);
}

export async function maybeNotifyErrorSpike(
  prisma: PrismaClient,
  projectId: string
): Promise<void> {
  const settings = await loadProjectAlertSettings(prisma, projectId);
  if (!settings.errorSpike.enabled) return;

  const { threshold, windowMinutes } = settings.errorSpike;
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);

  const count = await prisma.errorOccurrence.count({
    where: {
      created_at: { gte: since },
      error_group: { project_id: projectId },
    },
  });

  if (count < threshold) return;

  const dedupeKey = errorSpikeDedupeKey(projectId, windowMinutes);
  await fireProjectAlert(prisma, {
    projectId,
    rule: "ERROR_SPIKE",
    dedupeKey,
    title: "Error spike detected",
    body: `${count.toLocaleString()} errors in the last ${windowMinutes} minutes (threshold ${threshold}).`,
    href: "/dashboard/errors",
  });
}

export function quotaNearRatio(settings: ProjectAlertSettings): number {
  return settings.quota.nearPercent / 100;
}
