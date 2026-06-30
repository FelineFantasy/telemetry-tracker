export function ErrorState({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4"
      role="alert"
    >
      <p className="text-sm font-medium text-foreground">Could not load data</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Check that the API is reachable and try again.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-background/80 p-3 font-mono text-[11px] text-muted-foreground">
        {message}
      </pre>
    </div>
  );
}
