import type { ReactNode } from "react";

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

export function SettingsPreviewNote() {
  return (
    <p className="rounded-lg border border-border bg-surface/40 px-4 py-3 text-[13px] text-muted-foreground">
      Preview UI — data and actions on this page are not connected to the backend yet.
    </p>
  );
}
