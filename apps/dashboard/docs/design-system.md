# Dashboard design system

Dark-first UI tokens live in **`app/globals.css`** (CSS variables) and **`tailwind.config.ts`**. Prefer Tailwind utilities (`bg-background`, `text-muted-foreground`, `border-border`, `bg-brand`, …) for new UI.

Aesthetic: pure black canvas, near-white type, single blue brand accent, subtle 1px hairlines — ported from [pulse-beacon-studio](https://github.com/unjica/pulse-beacon-studio).

## Semantic colors

| Token | Usage |
|--------|--------|
| `background` | App canvas |
| `foreground` | Primary text |
| `surface` / `surface-elevated` | Panels, cards, elevated areas |
| `muted` / `muted-foreground` | Secondary fills and text |
| `border` / `border-strong` | Hairlines and dividers |
| `primary` / `primary-foreground` | Inverted CTAs (light pill on dark) |
| `secondary` | Subtle filled controls |
| `brand` / `brand-soft` | Blue accent (links, highlights) |
| `destructive` / `danger` | Errors and destructive actions |
| `success` / `warning` | Status |
| `code.*` | Code surfaces (maps to surface tokens) |

## shadcn/ui

Initialized via **`components.json`**. Primitives live in **`app/components/ui/shadcn/`** (button, card, badge, separator). Legacy dashboard components remain in **`app/components/ui/`** until Phase 3.

- **`lib/utils.ts`** — `cn()` with clsx + tailwind-merge
- Internal reference page: **`/design-system`**

## Fonts

`layout.tsx` sets Geist Sans and Geist Mono via the `geist` package. Tailwind `font-sans` / `font-mono` use `--font-geist-sans` and `--font-geist-mono`.

## Marketing

Landing sections live in **`app/components/marketing/`** — Nav, Hero, Features, SDKs, ProductShots, Pricing, DocsPreview, Cta, Footer.

## Legacy dashboard CSS

`globals.css` still contains class-based dashboard markup (`.card`, `.table`, sidebar, etc.) mapped to the new tokens via CSS variables. These will be migrated to shadcn in Phase 3+.
