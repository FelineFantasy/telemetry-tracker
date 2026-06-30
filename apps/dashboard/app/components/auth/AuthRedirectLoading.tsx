export function AuthRedirectLoading({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-brand"
          role="status"
          aria-label={message}
        />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
