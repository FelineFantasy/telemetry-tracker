import { DocSidebar } from "./components/DocSidebar";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="docs-wrap">
      <DocSidebar />
      <div className="docs-content">{children}</div>
    </div>
  );
}
