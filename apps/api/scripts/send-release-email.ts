import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/lib/db.js";
import {
  buildMarketingUnsubscribeUrl,
  generateMarketingUnsubscribeToken,
  hashMarketingUnsubscribeToken,
} from "../src/lib/marketing-subscriber.js";
import { sendTransactionalEmail, isTransactionalEmailConfigured } from "../src/lib/email.js";

const DRY_RUN = process.argv.includes("--dry-run");
const VERSION_ARG = process.argv.find((a) => a.startsWith("--version="))?.split("=")[1]?.trim();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownToHtml(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("### ")) {
        return `<h3 style="margin:1.25em 0 0.5em;font-size:16px;">${escapeHtml(trimmed.slice(4))}</h3>`;
      }
      if (trimmed.startsWith("- ")) {
        return `<li>${escapeHtml(trimmed.slice(2))}</li>`;
      }
      return `<p style="margin:0.75em 0;">${escapeHtml(trimmed)}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

function extractChangelogSection(version: string): string | null {
  const changelogPath = resolve(process.cwd(), "../../CHANGELOG.md");
  const content = readFileSync(changelogPath, "utf8");
  const header = version === "Unreleased" ? "## [Unreleased]" : `## [${version}]`;
  const start = content.indexOf(header);
  if (start === -1) return null;
  const rest = content.slice(start + header.length);
  const nextHeader = rest.search(/\n## \[/);
  const section = (nextHeader === -1 ? rest : rest.slice(0, nextHeader)).trim();
  return section || null;
}

async function main() {
  const version = VERSION_ARG ?? "Unreleased";
  const section = extractChangelogSection(version);
  if (!section) {
    console.error(`Could not find CHANGELOG section for ${version}`);
    process.exit(1);
  }

  if (!isTransactionalEmailConfigured()) {
    console.error("RESEND_API_KEY and TELEMETRY_EMAIL_FROM must be set.");
    process.exit(1);
  }

  const dashboardOrigin =
    process.env.TELEMETRY_DASHBOARD_ORIGIN?.trim() || "https://telemetry-tracker.com";

  const subscribers = await prisma.marketingSubscriber.findMany({
    where: { unsubscribed_at: null },
    select: { id: true, email: true },
    orderBy: { email: "asc" },
  });

  if (subscribers.length === 0) {
    console.log("No active marketing subscribers.");
    return;
  }

  const subject =
    version === "Unreleased"
      ? "Telemetry Tracker — what's new"
      : `Telemetry Tracker ${version} is out`;

  const bodyHtml = [
    `<p>Hi,</p>`,
    `<p>Here's what's new in Telemetry Tracker${version === "Unreleased" ? "" : ` ${version}`}:</p>`,
    markdownToHtml(section),
    `<p style="margin-top:1.5em;"><a href="${escapeHtml(dashboardOrigin)}/docs/releases">Read full release notes</a></p>`,
  ].join("\n");

  console.log(`Prepared release email for ${subscribers.length} subscriber(s).`);
  console.log(`Subject: ${subject}`);
  if (DRY_RUN) {
    console.log("--dry-run: not sending.");
    return;
  }

  let sent = 0;
  for (const sub of subscribers) {
    const rawToken = generateMarketingUnsubscribeToken();
    await prisma.marketingSubscriber.update({
      where: { id: sub.id },
      data: { unsubscribe_token: hashMarketingUnsubscribeToken(rawToken) },
    });
    const unsubscribeUrl = buildMarketingUnsubscribeUrl(dashboardOrigin, rawToken);
    const html = [
      bodyHtml,
      `<hr style="margin:2em 0;border:none;border-top:1px solid #eee;" />`,
      `<p style="font-size:12px;color:#666;">`,
      `You received this because you subscribed to Telemetry Tracker product updates.`,
      ` <a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a>`,
      `</p>`,
    ].join("\n");

    const result = await sendTransactionalEmail({ to: sub.email, subject, html });
    if (result.sent) sent += 1;
    else console.warn(`Failed to send to ${sub.email}:`, result.error ?? result.status);
  }

  console.log(`Sent ${sent}/${subscribers.length} release email(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
