import type { Metadata } from "next";
import Link from "next/link";
import { AuthPageShell } from "@/app/components/auth/AuthPageShell";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Choose new password",
  robots: { index: false, follow: true },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const trimmed = typeof token === "string" ? token.trim() : "";

  return (
    <AuthPageShell mode="reset-password">
      {!trimmed ? (
        <p className="text-sm text-destructive" role="alert">
          Missing reset token. Request a new link from{" "}
          <Link
            href="/forgot-password"
            className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          >
            forgot password
          </Link>
          .
        </p>
      ) : (
        <ResetPasswordForm token={trimmed} />
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link
          href="/"
          className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
        >
          ← Back to home
        </Link>
      </p>
    </AuthPageShell>
  );
}
