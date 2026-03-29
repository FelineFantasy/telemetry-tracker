import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Sign in · Telemetry Tracker",
};

export default function LoginPage() {
  return (
    <div className="auth-page">
      <div className="auth-page__panel card">
        <h1 className="auth-page__title">Sign in</h1>
        <p className="auth-page__lede">
          Use your dashboard account for this organization.
        </p>
        <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
          <LoginForm />
        </Suspense>
        <p className="auth-page__hint text-muted-foreground">
          <Link href="/">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
