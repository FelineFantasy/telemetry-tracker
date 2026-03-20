import { DocsShell } from "@/app/components/docs/DocsShell";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="docs-layout-root">
      <DocsShell>
        <div className="docs-content">{children}</div>
      </DocsShell>
    </div>
  );
}
