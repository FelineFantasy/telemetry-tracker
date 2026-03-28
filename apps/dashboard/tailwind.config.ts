import type { Config } from "tailwindcss";

/**
 * Dark-first design tokens — brand palette (8-digit sources: #674fdcfc #8a7de4fe #b6abebfe #c0b9e128, transparent #00000000).
 * Solid: primary #674fdc, mid #8a7de4, light #b6abeb, muted #c0b9e1.
 * Use semantic utilities: bg-background, text-foreground, border-border, bg-primary, etc.
 */
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(15 10 35 / 0.12)",
        sm: "0 1px 3px 0 rgb(15 10 35 / 0.14), 0 1px 2px -1px rgb(15 10 35 / 0.1)",
        md: "0 4px 6px -1px rgb(15 10 35 / 0.18), 0 2px 4px -2px rgb(15 10 35 / 0.12)",
        lg: "0 10px 15px -3px rgb(15 10 35 / 0.22), 0 4px 6px -4px rgb(15 10 35 / 0.16)",
        glow: "0 0 0 1px rgb(103 79 220 / 0.2), 0 8px 32px rgb(138 125 228 / 0.14)",
        "inner-soft": "inset 0 1px 0 0 rgb(255 255 255 / 0.04)",
      },
      colors: {
        /* Soft purple-gray canvas (aligned with brand — not near-black) */
        background: "#06060f",
        foreground: "#ffffff",
        surface: {
          DEFAULT: "#3d3758",
          alt: "#45406a",
          raised: "#4e4878",
        },
        muted: {
          DEFAULT: "#4a4565",
          foreground: "#d4d0e8",
        },
        border: {
          DEFAULT: "#5c5678",
          subtle: "#6a6488",
        },
        primary: {
          DEFAULT: "#674fdc",
          foreground: "#ffffff",
          hover: "#8a7de4",
        },
        secondary: {
          DEFAULT: "#8a7de4",
          foreground: "#1a1428",
          hover: "#b6abeb",
        },
        accent: {
          DEFAULT: "#b6abeb",
          foreground: "#161632",
        },
        danger: {
          DEFAULT: "#f87171",
          foreground: "#450a0a",
          muted: "rgba(248, 113, 113, 0.12)",
        },
        success: {
          DEFAULT: "#34d399",
          foreground: "#022c22",
          muted: "rgba(52, 211, 153, 0.12)",
        },
        warning: {
          DEFAULT: "#fbbf24",
          foreground: "#422006",
          muted: "rgba(251, 191, 36, 0.12)",
        },
        code: {
          bg: "#353050",
          border: "#5c5690",
          foreground: "#c0b9e1",
        },
        ring: "#8a7de4",
      },
      maxWidth: {
        prose: "65ch",
        content: "1200px",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
