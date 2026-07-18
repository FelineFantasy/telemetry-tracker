import type { PrismaClient } from "@prisma/client";
import {
  resolveAlertRulesScheduleIntervalMinutes,
  runScheduledAlertRuleEvaluation,
  type ScheduledAlertRuleEvaluationResult,
} from "../lib/alert-rules.js";

export type AlertRulesEvaluatorSweepResult = ScheduledAlertRuleEvaluationResult & {
  intervalMinutes: number;
};

/**
 * One scheduled evaluation tick. Safe to re-run: cooldown dedupe makes fires idempotent
 * within each rule's cooldown window.
 */
export async function runAlertRulesEvaluatorSweep(
  prisma: PrismaClient,
  env: NodeJS.ProcessEnv = process.env
): Promise<AlertRulesEvaluatorSweepResult> {
  const intervalMinutes = resolveAlertRulesScheduleIntervalMinutes(env);
  const result = await runScheduledAlertRuleEvaluation(prisma);
  return { ...result, intervalMinutes };
}
