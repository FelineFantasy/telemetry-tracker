# `app/components`

Shared UI for the Next.js app. Import with the `@/app/components/...` alias (see `tsconfig.json`).

| Folder | Purpose |
|--------|---------|
| **`ui/`** | Primitives: `Button`, `Table` (`TableWrap`, `Table`, `TableListLink`). |
| **`sidebar/`** | Shared app rail: `SidebarBrand`, `SidebarCloseIcon`, `MenuIcon`; used by `AppSidebar` + `DocSidebar`. |
| **`dashboard/`** | Dashboard shell & nav: `DashboardShell`, `AppSidebar`, `DashboardViewLinks`, `SidebarLink`, `RangeTabs`, `NavBack`. |
| **`docs/`** | Documentation section: `DocsShell` (mobile rail + backdrop), `DocSidebar`, `DocsArticle`, `CodeBlock`. |
| **`lib/`** | `cn`, `search-params`, **`useMobileDrawer`** (matches `max-width: 767px` for drawers). |
| **(root)** | Cross-route pieces: `Card`, `Badge`, `PageTitle`, `EmptyState`, `ErrorState`, `LandingHeader`. |

Route-specific widgets stay next to routes (e.g. `app/dashboard/events/EventsFilter.tsx`).
