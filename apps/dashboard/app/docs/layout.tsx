import { AuthModalProvider } from "@/app/components/marketing/auth-modals";
import { DocsPageShell } from "@/app/components/docs/DocsPageShell";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthModalProvider>
      <DocsPageShell>{children}</DocsPageShell>
    </AuthModalProvider>
  );
}
