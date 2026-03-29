import Link from "next/link";
import { RegisterForm } from "./RegisterForm";

export const metadata = {
  title: "Create account · Telemetry Tracker",
};

export default function RegisterPage() {
  return (
    <div className="auth-page">
      <div className="auth-page__panel card">
        <h1 className="auth-page__title">Create account</h1>
        <p className="auth-page__lede">
          The first user becomes organization owner. Further signups may be disabled by your
          deployment settings.
        </p>
        <RegisterForm />
        <p className="auth-page__hint text-muted-foreground">
          <Link href="/">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
