# `app/components`

Shared UI for the Next.js app. Import with the `@/app/components/...` alias (see `tsconfig.json`).

| Folder | Purpose |
|--------|---------|
| **`ui/`** | Primitives: `Button`, `Table` (`TableWrap`, `Table`, `TableListLink`). |
| **`dashboard/`** | Dashboard shell & nav: `DashboardShell`, `AppSidebar`, `DashboardViewLinks`, `SidebarLink`, `RangeTabs`, `NavBack`. |
| **`docs/`** | Documentation section: `DocsTopBar`, `DocSidebar`, `DocsArticle`, `CodeBlock`. |
| **(root)** | Cross-route pieces: `Card`, `Badge`, `PageTitle`, `EmptyState`, `ErrorState`, `LandingHeader`. |

Route-specific widgets stay next to routes (e.g. `app/dashboard/events/EventsFilter.tsx`).
