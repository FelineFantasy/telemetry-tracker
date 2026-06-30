import type { ReactNode } from "react";
import { ComingSoonBanner } from "../coming-soon-ui";

export function SettingsPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex items-start justify-between gap-4 border-b border-border pb-6">
      <div>
        <h1 className="text-2xl tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SettingsPageBody({ children }: { children: ReactNode }) {
  return <div className="space-y-6 pb-24">{children}</div>;
}

/** Banner for settings pages that are not wired to the backend yet. */
export function SettingsComingSoonNote() {
  return <ComingSoonBanner />;
}

/** @deprecated Use SettingsComingSoonNote */
export const SettingsPreviewNote = SettingsComingSoonNote;
