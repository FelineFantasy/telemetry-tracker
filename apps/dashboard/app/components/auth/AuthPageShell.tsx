import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/app/components/marketing/logo";

const inputCls =
  "w-full rounded-lg border border-border bg-background/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

const COPY = {
  login: {
    title: "Welcome back",
    description: "Sign in to continue to your dashboard.",
  },
  register: {
    title: "Create your account",
    description: "Start tracking errors, events, and sessions in minutes.",
  },
  "forgot-password": {
    title: "Reset password",
    description:
      "Enter your account email. If it exists, we will create a reset link (shown here in development; email in production when configured).",
  },
  "reset-password": {
    title: "Choose a new password",
    description: "Enter a new password for your account.",
  },
} as const;

export function AuthPageShell({
  children,
  mode = "login",
  title,
  description,
  showTerms,
}: {
  children: ReactNode;
  mode?: keyof typeof COPY;
  title?: string;
  description?: string;
  showTerms?: boolean;
}) {
  const copy = COPY[mode];
  const resolvedTitle = title ?? copy.title;
  const resolvedDescription = description ?? copy.description;
  const termsVisible = showTerms ?? (mode === "login" || mode === "register");

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 grid-bg opacity-[0.35]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] glow-blue opacity-70" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <Link href="/" className="inline-flex w-fit">
          <Logo />
        </Link>

        <div className="mt-16 flex-1">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">{resolvedTitle}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{resolvedDescription}</p>
          </div>

          <div className="rounded-2xl border border-border bg-surface/60 p-6 backdrop-blur-sm">
            {children}
          </div>

          {termsVisible ? (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              By continuing you agree to our{" "}
              <Link
                href="/terms"
                className="text-foreground/85 underline decoration-border underline-offset-4 hover:decoration-foreground"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="text-foreground/85 underline decoration-border underline-offset-4 hover:decoration-foreground"
              >
                Privacy Policy
              </Link>
              .
            </p>
          ) : null}
        </div>

        <p className="mt-10 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Telemetry Tracker · open source
        </p>
      </div>
    </div>
  );
}

export function AuthSubmitButton({
  children,
  pending,
}: {
  children: ReactNode;
  pending?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-60"
    >
      {children}
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 8h10M9 4l4 4-4 4" />
      </svg>
    </button>
  );
}

export function AuthField({
  label,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
  autoComplete,
  id,
  rightLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  id?: string;
  rightLabel?: ReactNode;
}) {
  return (
    <label className="block" htmlFor={id}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        {rightLabel}
      </div>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        className={inputCls}
      />
      {error ? <p className="mt-1.5 text-xs text-destructive">{error}</p> : null}
    </label>
  );
}

export { inputCls as authInputCls };
