# Dashboard design system

Dark-first UI tokens live in **`tailwind.config.ts`**. Prefer Tailwind utilities (`bg-background`, `text-muted-foreground`, `border-border`, `bg-primary`, …) for new UI.

## Semantic colors

| Token | Usage |
|--------|--------|
| `background` | App canvas |
| `foreground` | Primary text |
| `surface` / `surface-alt` / `surface-raised` | Panels, cards, elevated areas |
| `muted` / `muted-foreground` | Borders-as-fill, secondary text |
| `border` / `border-subtle` | Hairlines and dividers |
| `primary` / `primary-hover` / `primary-foreground` | Brand accent (teal), CTAs |
| `secondary` | Indigo accent |
| `danger` / `success` / `warning` | Status + alerts |
| `code.bg` / `code.border` / `code.foreground` | Code surfaces (teal-tinted; related to but distinct from `primary`) |

## Legacy CSS

`globals.css` maps **`--color-*`** variables to the same theme via `theme()` for existing class-based markup (`.card`, `.table`, `.landing-*`, etc.).

## Components

See **`app/components/README.md`** for the folder layout.

- **`app/components/ui/Button.tsx`** — `Button` / `ButtonLink` (`primary` | `secondary` | `ghost` | `outline`).
- **`app/components/ui/Table.tsx`** — `TableWrap`, `Table`, `TableListLink` (dashboard tables; styles map to `.table`, `.table-wrap`, `.list-link` in `globals.css`).
- **`app/components/dashboard/`** — `DashboardShell`, `AppSidebar`, `SidebarLink`, `DashboardViewLinks`, `RangeTabs`, `NavBack`.
- **`app/components/sidebar/`** — `SidebarBrand` (Telemetry Tracker + mobile drawer close), `SidebarCloseIcon`, `MenuIcon`; shared by dashboard and docs rails.
- **`lib/useMobileDrawer.ts`** — `useMobileDrawer()` hook; matches the `max-width: 767px` drawer breakpoint.
- **`app/components/docs/`** — `DocsShell`, `DocSidebar`, `DocsArticle`, `CodeBlock`.
- **Navigation** — **`SidebarLink`** + sidebar classes; **`text-link`** for inline actions where needed.

## Fonts

`layout.tsx` sets `--font-sans` (DM Sans) and `--font-mono` (JetBrains Mono); Tailwind `font-sans` / `font-mono` use these variables.
