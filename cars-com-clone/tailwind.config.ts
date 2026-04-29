import type { Config } from "tailwindcss";
const { fontFamily } = require("tailwindcss/defaultTheme");

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        "apercu-regular": ["var(--font-space-grotesk)", ...fontFamily.sans],
        "apercu-bold": ["var(--font-space-grotesk)", ...fontFamily.sans],
        "dm-sans": ["var(--font-inter)", ...fontFamily.sans],
      },
      colors: {
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        input: "hsl(var(--input))",
        "input-foreground": "hsl(var(--input-foreground))",
        placeholder: "hsl(var(--placeholder))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: "hsl(var(--surface))",
        "surface-elevated": "hsl(var(--surface-elevated))",
        "surface-muted": "hsl(var(--surface-muted))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        shadow: "hsl(var(--shadow))",
        overlay: "hsl(var(--overlay))",
        "hero-panel": "hsl(var(--hero-panel))",
        "hero-foreground": "hsl(var(--hero-foreground))",
        "metric-panel": "hsl(var(--metric-panel))",
        "metric-foreground": "hsl(var(--metric-foreground))",
        // Cars.com specific colors
        "cars-primary": "rgb(var(--cars-primary) / <alpha-value>)",
        "cars-primary-light": "rgb(var(--cars-primary-light) / <alpha-value>)",
        "cars-primary-dark": "rgb(var(--cars-primary-dark) / <alpha-value>)",
        "cars-accent": "rgb(var(--cars-accent) / <alpha-value>)",
        "cars-accent-light": "rgb(var(--cars-accent-light) / <alpha-value>)",
        "cars-gray": "rgb(var(--cars-gray) / <alpha-value>)",
        "cars-gray-light": "rgb(var(--cars-gray-light) / <alpha-value>)",
        "cars-off-white": "rgb(var(--cars-off-white) / <alpha-value>)",
        "cars-surface": "hsl(var(--surface))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
