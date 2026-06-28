import type { Config } from "tailwindcss";

/**
 * Pulse-beacon design tokens — pure black canvas, near-white type, blue brand accent.
 * shadcn semantic colors map to CSS variables in globals.css.
 */
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.24)",
        sm: "0 1px 3px 0 rgb(0 0 0 / 0.28)",
        md: "0 4px 6px -1px rgb(0 0 0 / 0.32)",
        lg: "0 10px 15px -3px rgb(0 0 0 / 0.36)",
        "inner-soft": "inset 0 1px 0 0 rgb(255 255 255 / 0.04)",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
          hover: "var(--brand)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
          hover: "var(--secondary)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        brand: {
          DEFAULT: "var(--brand)",
          soft: "var(--brand-soft)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          elevated: "var(--surface-elevated)",
          alt: "var(--surface-elevated)",
          raised: "var(--surface-elevated)",
        },
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
          subtle: "var(--border-strong)",
        },
        input: "var(--input)",
        ring: "var(--ring)",
        success: {
          DEFAULT: "var(--success)",
          foreground: "var(--foreground)",
          muted: "oklch(0.78 0.16 150 / 14%)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          foreground: "var(--foreground)",
          muted: "oklch(0.82 0.16 75 / 14%)",
        },
        danger: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
          muted: "oklch(0.66 0.22 22 / 14%)",
        },
        code: {
          bg: "var(--surface)",
          border: "var(--border-strong)",
          foreground: "var(--foreground)",
        },
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
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.55", transform: "scale(0.9)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
