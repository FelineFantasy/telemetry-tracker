import Link from "next/link";
import type { ChangelogCategory, ChangelogRelease } from "@/lib/changelog";
import { GITHUB_RELEASES_BASE } from "@/lib/changelog";

const CATEGORY_ORDER: ChangelogCategory[] = [
  "Added",
  "Changed",
  "Fixed",
  "Deprecated",
  "Removed",
  "Security",
];

const CATEGORY_LABEL: Record<ChangelogCategory, string> = {
  Added: "Added",
  Changed: "Changed",
  Fixed: "Fixed",
  Deprecated: "Deprecated",
  Removed: "Removed",
  Security: "Security",
};

function renderInline(text: string) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = link[2]!;
      const external = href.startsWith("http");
      return (
        <Link
          key={i}
          href={href}
          className="text-brand hover:underline"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {link[1]}
        </Link>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-medium text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function ReleaseCard({ release }: { release: ChangelogRelease }) {
  const tag = release.prerelease ? null : `v${release.version}`;
  const categories = CATEGORY_ORDER.filter((c) => release.categories[c]?.length);

  return (
    <section
      id={release.anchor}
      className="scroll-mt-32 border-b border-border pb-10 last:border-b-0 last:pb-0"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-xl font-semibold tracking-tight">
          {release.prerelease ? (
            <span className="text-foreground">{release.version}</span>
          ) : (
            <span className="font-mono text-foreground">v{release.version}</span>
          )}
        </h2>
        {release.date ? (
          <time dateTime={release.date} className="text-sm text-muted-foreground">
            {release.date}
          </time>
        ) : null}
        {tag ? (
          <Link
            href={`${GITHUB_RELEASES_BASE}/${tag}`}
            className="text-sm text-brand hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub release →
          </Link>
        ) : null}
      </div>

      {release.summary.length > 0 ? (
        <div className="mt-5 space-y-2">
          {release.summary.map((paragraph) => (
            <p key={paragraph} className="text-[15px] leading-relaxed text-foreground/85">
              {renderInline(paragraph)}
            </p>
          ))}
        </div>
      ) : null}

      {categories.length === 0 && release.summary.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No entries yet.</p>
      ) : categories.length > 0 ? (
        <div className="mt-5 space-y-5">
          {categories.map((cat) => (
            <div key={cat}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {CATEGORY_LABEL[cat]}
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-foreground/85">
                {release.categories[cat]!.map((item) => (
                  <li key={item}>{renderInline(item)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function ChangelogReleases({ releases }: { releases: ChangelogRelease[] }) {
  const unreleased = releases.find((r) => r.prerelease);
  const shipped = releases.filter((r) => !r.prerelease);

  return (
    <div className="space-y-10">
      {unreleased &&
      (Object.keys(unreleased.categories).length > 0 || unreleased.summary.length > 0) ? (
        <ReleaseCard release={unreleased} />
      ) : null}
      {shipped.map((release) => (
        <ReleaseCard key={release.version} release={release} />
      ))}
    </div>
  );
}
