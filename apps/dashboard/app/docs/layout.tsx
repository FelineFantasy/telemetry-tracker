import { DocsTopBar } from "@/app/components/docs/DocsTopBar";
import { DocSidebar } from "@/app/components/docs/DocSidebar";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DocsTopBar />
      <main className="main" id="main-content">
        <div className="docs-wrap">
          <DocSidebar />
          <div className="docs-content">{children}</div>
        </div>
      </main>
    </>
  );
}
