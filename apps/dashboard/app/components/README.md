# `app/components`

Shared UI for the Next.js app. Import with the `@/app/components/...` alias (see `tsconfig.json`).

| Folder | Purpose |
|--------|---------|
| **`ui/shadcn/`** | shadcn primitives: `Button`, `Card`, `Badge`, `Separator` (new design system). |
| **`ui/`** | Legacy primitives: `Button`, `Table` — migrate to shadcn in Phase 3. |
| **`sidebar/`** | Shared app rail: `SidebarBrand`, `SidebarCloseIcon`, `MenuIcon`; used by `AppSidebar` + `DocSidebar`. |
| **`dashboard/`** | Dashboard shell & nav: `DashboardShell`, `AppSidebar`, `DashboardViewLinks`, `SidebarLink`, `RangeTabs`, `NavBack`. |
| **`docs/`** | Documentation section: `DocsShell` (mobile rail + backdrop), `DocSidebar`, `DocsArticle`, `CodeBlock`. |
| **`lib/`** | `cn`, `search-params`, **`useMobileDrawer`** (matches `max-width: 767px` for drawers). |
| **`marketing/`** | Landing page sections: `Nav`, `Hero`, `Features`, `Sdks`, `Pricing`, etc. |
| **(root)** | Cross-route pieces: `Card`, `Badge`, `PageTitle`, `EmptyState`, `ErrorState`. |

Route-specific widgets stay next to routes (e.g. list filters live in each route’s `page.tsx`).
