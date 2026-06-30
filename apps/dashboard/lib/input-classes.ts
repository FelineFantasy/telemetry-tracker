/** Shared classes for text fields — no focus ring; border change only where specified. */
export const inputFieldClassName =
  "w-full outline-none ring-0 ring-offset-0 shadow-none transition-colors placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";

export const settingsInputClassName = `${inputFieldClassName} rounded-md border border-border bg-surface/60 px-3 py-1.5 text-[13px] focus:border-border-strong`;

export const authInputClassName = `${inputFieldClassName} rounded-lg border border-border bg-background/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-border-strong`;

export const filterInputClassName = `${inputFieldClassName} h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground/60 hover:border-muted-foreground/30 focus:border-border-strong`;

/** Borderless popover search fields — transparent border shows focus via border-strong. */
export const searchInputClassName = `${inputFieldClassName} rounded-md border border-transparent bg-transparent px-1 text-sm text-foreground placeholder:text-muted-foreground focus:border-border-strong`;
