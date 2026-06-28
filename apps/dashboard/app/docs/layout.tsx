import { DocsPageShell } from "@/app/components/docs/DocsPageShell";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DocsPageShell>{children}</DocsPageShell>;
}
