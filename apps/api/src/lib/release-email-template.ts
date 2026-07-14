/** Dashboard-aligned palette (light theme approximations for email clients). */
const COLORS = {
  background: "#f6f7fb",
  card: "#ffffff",
  foreground: "#1c1f28",
  muted: "#647089",
  border: "#e4e7ef",
  brand: "#4a5fe8",
  brandSoft: "#eef1ff",
  surface: "#f0f2f7",
} as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const GITHUB_REPO_DOCS_BASE =
  "https://github.com/Telemetry-Tracker/telemetry-tracker/blob/main";

/** Resolve repo-relative CHANGELOG links for email clients. */
export function resolveChangelogLink(href: string, dashboardOrigin: string): string {
  const trimmed = href.trim();
  if (!trimmed) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }

  const hashIndex = trimmed.indexOf("#");
  const pathPart = hashIndex === -1 ? trimmed : trimmed.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : trimmed.slice(hashIndex);
  const origin = dashboardOrigin.replace(/\/$/, "");

  if (pathPart.startsWith("/")) {
    return `${origin}${pathPart}${hash}`;
  }

  const path = pathPart.replace(/^(\.\.\/)+/, "").replace(/^\.\//, "");
  if (path.endsWith(".md") || path.startsWith("docs/") || path.startsWith(".github/")) {
    return `${GITHUB_REPO_DOCS_BASE}/${path}${hash}`;
  }

  return `${origin}/${path}${hash}`;
}

/** Parse **bold** and [label](url) in changelog lines. */
export function parseInlineMarkdown(raw: string, dashboardOrigin: string): string {
  const tokenRe = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(raw)) !== null) {
    result += escapeHtml(raw.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
      result += `<strong style="font-weight:600;color:${COLORS.foreground};">${escapeHtml(match[1])}</strong>`;
    } else if (match[2] !== undefined && match[3] !== undefined) {
      const href = escapeHtml(resolveChangelogLink(match[3], dashboardOrigin));
      result += `<a href="${href}" style="color:${COLORS.brand};text-decoration:none;font-weight:500;">${escapeHtml(match[2])}</a>`;
    }
    lastIndex = match.index + match[0].length;
  }

  result += escapeHtml(raw.slice(lastIndex));
  return result;
}

function flushListItems(items: string[]): string {
  if (items.length === 0) return "";
  return `<ul style="margin:0 0 16px;padding:0 0 0 18px;color:${COLORS.foreground};font-size:15px;line-height:1.55;">${items.join("")}</ul>`;
}

/** Convert a CHANGELOG section body to HTML fragments (lists, headings). */
export function changelogMarkdownToHtml(markdown: string, dashboardOrigin: string): string {
  const lines = markdown.split("\n");
  const blocks: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(flushListItems(listItems));
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "---") {
      flushList();
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushList();
      const label = escapeHtml(trimmed.slice(4));
      blocks.push(
        `<p style="margin:24px 0 10px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};">${label}</p>`
      );
      continue;
    }

    if (trimmed.startsWith("- ")) {
      listItems.push(
        `<li style="margin:0 0 10px;">${parseInlineMarkdown(trimmed.slice(2), dashboardOrigin)}</li>`
      );
      continue;
    }

    flushList();
    blocks.push(
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:${COLORS.foreground};">${parseInlineMarkdown(trimmed, dashboardOrigin)}</p>`
    );
  }

  flushList();
  return blocks.join("\n");
}

export function buildReleaseEmailBodyHtml(options: {
  version: string;
  sectionMarkdown: string;
  dashboardOrigin: string;
}): string {
  const { version, sectionMarkdown, dashboardOrigin } = options;
  const origin = dashboardOrigin.replace(/\/$/, "");
  const versionLabel = version === "Unreleased" ? "What's new" : `v${version}`;
  const headline =
    version === "Unreleased"
      ? "Here's what's new in Telemetry Tracker"
      : `Telemetry Tracker ${version} is here`;

  const content = changelogMarkdownToHtml(sectionMarkdown, origin);
  const releasesUrl = `${origin}/docs/releases`;
  const dashboardUrl = `${origin}/dashboard/overview`;
  const logoUrl = `${origin}/telemetry-logo.jpg`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(headline)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.background};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px 20px;border-bottom:1px solid ${COLORS.border};background:linear-gradient(180deg, ${COLORS.surface} 0%, ${COLORS.card} 100%);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="display:inline-flex;align-items:center;gap:10px;">
                      <img src="${escapeHtml(logoUrl)}" alt="" width="28" height="28" style="display:block;border-radius:8px;" />
                      <span style="font-size:15px;font-weight:600;letter-spacing:-0.02em;color:${COLORS.foreground};">
                        Telemetry<span style="color:${COLORS.muted};"> / </span>Tracker
                      </span>
                    </span>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${COLORS.brandSoft};color:${COLORS.brand};font-size:12px;font-weight:600;letter-spacing:0.02em;">${escapeHtml(versionLabel)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;">
              <p style="margin:0 0 8px;font-size:13px;color:${COLORS.muted};">Hi there,</p>
              <h1 style="margin:0 0 20px;font-size:22px;font-weight:600;line-height:1.3;letter-spacing:-0.02em;color:${COLORS.foreground};">${escapeHtml(headline)}</h1>
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px;">
                    <a href="${escapeHtml(releasesUrl)}" style="display:inline-block;padding:11px 18px;border-radius:999px;background:${COLORS.foreground};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">Release notes</a>
                  </td>
                  <td>
                    <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:11px 18px;border-radius:999px;border:1px solid ${COLORS.border};background:${COLORS.card};color:${COLORS.foreground};font-size:14px;font-weight:600;text-decoration:none;">Open dashboard</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:${COLORS.muted};max-width:560px;text-align:center;">
          You received this because you subscribed to Telemetry Tracker product updates.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function appendReleaseEmailFooter(html: string, unsubscribeUrl: string): string {
  const footer = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:${COLORS.muted};max-width:560px;text-align:center;">
  <a href="${escapeHtml(unsubscribeUrl)}" style="color:${COLORS.muted};text-decoration:underline;">Unsubscribe</a>
</p></td></tr></table>`;

  return html.replace("</body>", `${footer}</body>`);
}
