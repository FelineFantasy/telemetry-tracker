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

- **`app/components/ui/Button.tsx`** — `Button` / `ButtonLink` with `primary` | `secondary` | `ghost` | `outline` variants (`buttonClass` export for composing with `Link`).
- **Navigation** — Dashboard/docs top bars use **`nav-link`**; inline actions use **`text-link`**.

## Fonts

`layout.tsx` sets `--font-sans` (DM Sans) and `--font-mono` (JetBrains Mono); Tailwind `font-sans` / `font-mono` use these variables.
