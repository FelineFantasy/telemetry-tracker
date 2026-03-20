import type { Config } from "tailwindcss";

/**
 * Dark-first design tokens (Vercel / Linear–inspired).
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
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.35)",
        sm: "0 1px 3px 0 rgb(0 0 0 / 0.4), 0 1px 2px -1px rgb(0 0 0 / 0.35)",
        md: "0 4px 6px -1px rgb(0 0 0 / 0.45), 0 2px 4px -2px rgb(0 0 0 / 0.4)",
        lg: "0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.45)",
        glow: "0 0 0 1px rgb(20 184 166 / 0.15), 0 8px 32px rgb(20 184 166 / 0.12)",
        "inner-soft": "inset 0 1px 0 0 rgb(255 255 255 / 0.04)",
      },
      colors: {
        /* Soft slate canvas — avoids harsh pure black */
        background: "#12161f",
        foreground: "#f4f4f5",
        surface: {
          DEFAULT: "#1a1f2c",
          alt: "#1e2433",
          raised: "#232a3a",
        },
        muted: {
          DEFAULT: "#2a3142",
          foreground: "#a1a8b8",
        },
        border: {
          DEFAULT: "#2f3748",
          subtle: "#3d4659",
        },
        primary: {
          DEFAULT: "#14b8a6",
          foreground: "#042f2e",
          hover: "#0d9488",
        },
        secondary: {
          DEFAULT: "#6366f1",
          foreground: "#eef2ff",
          hover: "#4f46e5",
        },
        accent: {
          DEFAULT: "#8b5cf6",
          foreground: "#f5f3ff",
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
          bg: "#0f1f1c",
          border: "#1d4f47",
          foreground: "#8ed4c6",
        },
        ring: "#2dd4bf",
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
