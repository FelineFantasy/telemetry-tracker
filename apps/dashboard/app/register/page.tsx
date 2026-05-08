import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: true },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const sp = await searchParams;
  const inviteToken = typeof sp.invite === "string" ? sp.invite : "";
  return (
    <div className="auth-page">
      <div className="auth-page__panel card">
        <h1 className="auth-page__title">Create account</h1>
        <p className="auth-page__lede">
          {inviteToken
            ? "Complete registration to join the organization you were invited to."
            : "The first user becomes organization owner. Further signups may be disabled by your deployment settings."}
        </p>
        <RegisterForm inviteToken={inviteToken} />
        <p className="auth-page__hint text-muted-foreground">
          <Link href="/">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
