import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--primary)",
          light: "var(--primary-light)",
        },
        bg: "var(--bg)",
        surface: "var(--surface)",
        ink: "var(--text)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        pos: "var(--pos)",
        warn: "var(--warn)",
        neg: "var(--neg)",
      },
      fontFamily: {
        sans: ["var(--font-nunito)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 8px 24px -12px rgba(80,55,45,.16)",
        cta: "0 16px 28px -12px var(--primary)",
        soft: "0 4px 12px -6px rgba(80,55,45,.25)",
      },
      borderRadius: {
        xl2: "20px",
      },
      maxWidth: {
        app: "480px",
      },
    },
  },
  plugins: [],
};

export default config;
